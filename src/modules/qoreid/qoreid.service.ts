import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * Qoreid Verification Response
 */
export interface QoreidVerificationResponse {
  id: number;
  applicant: {
    firstname: string;
    lastname: string;
    middlename?: string;
    dob?: string;
    phone?: string;
    email?: string;
    gender?: string;
  };
  summary: {
    nin_check?: {
      status: string;
      fieldMatches: Record<string, boolean>;
    };
    bvn_match_check?: {
      status: string;
      fieldMatches: Record<string, boolean>;
    };
    bvn_check?: {
      status: string;
      fieldMatches: Record<string, boolean>;
    };
    drivers_license_check?: {
      status: string;
      fieldMatches: Record<string, boolean>;
    };
  };
  status: {
    state: string;
    status: string;
  };
  nin?: {
    nin: string;
    firstname: string;
    middlename?: string;
    lastname: string;
    phone?: string;
    gender?: string;
    birthdate?: string;
    photo?: string;
    address?: string;
  };
  bvn?: {
    bvn: string;
    firstname: string;
    middlename?: string;
    lastname: string;
    phone?: string;
    gender?: string;
    birthdate?: string;
    photo?: string;
  };
  driversLicense?: {
    licenseNumber: string;
    firstname: string;
    lastname: string;
    expiryDate?: string;
    issuedDate?: string;
    stateOfIssue?: string;
    photo?: string;
  };
}

/**
 * Verification Request Parameters
 */
export interface VerificationParams {
  firstname: string;
  lastname: string;
  middlename?: string;
  dob?: string; // YYYY-MM-DD
  phone?: string;
  email?: string;
  gender?: string;
}

/**
 * Qoreid Service
 *
 * Provides digital identity verification services via Qoreid API.
 * Handles token management and API communication.
 */
@Injectable()
export class QoreidService {
  private readonly logger = new Logger(QoreidService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('qoreid.baseUrl', 'https://api.qoreid.com');
    this.clientId = this.configService.get<string>('qoreid.clientId', '');
    this.clientSecret = this.configService.get<string>('qoreid.clientSecret', '');
  }

  /**
   * Get access token (with caching)
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/token`, {
          clientId: this.clientId,
          secret: this.clientSecret,
        }),
      );

      this.accessToken = response.data.accessToken;

      // Set expiry with 5 minute buffer
      const expiresInSeconds = parseInt(response.data.expiresIn) || 7200;
      this.tokenExpiresAt = new Date(Date.now() + (expiresInSeconds - 300) * 1000);

      this.logger.log('Qoreid access token refreshed');
      return this.accessToken!;
    } catch (error) {
      this.logger.error('Failed to get Qoreid access token', error.message);
      throw new HttpException(
        'Identity verification service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.getAccessToken();

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      const response =
        method === 'GET'
          ? await firstValueFrom(this.httpService.get(`${this.baseUrl}${endpoint}`, config))
          : await firstValueFrom(this.httpService.post(`${this.baseUrl}${endpoint}`, data, config));

      return response.data;
    } catch (error) {
      this.logger.error(`Qoreid API error: ${endpoint}`, error.response?.data || error.message);

      if (error.response?.status === 401) {
        // Token expired, clear cache and retry once
        this.accessToken = null;
        this.tokenExpiresAt = null;
        return this.makeRequest<T>(method, endpoint, data);
      }

      throw new HttpException(
        error.response?.data?.message || 'Identity verification failed',
        error.response?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ============================================================================
  // NIN Verification
  // ============================================================================

  /**
   * Verify NIN (National Identity Number)
   * Uses the NIN number directly for verification
   */
  async verifyNIN(
    nin: string,
    params: VerificationParams,
  ): Promise<QoreidVerificationResponse> {
    this.logger.log(`Verifying NIN: ${nin.substring(0, 4)}****`);

    return this.makeRequest<QoreidVerificationResponse>(
      'POST',
      `/v1/ng/identities/nin/${nin}`,
      {
        firstname: params.firstname,
        lastname: params.lastname,
        middlename: params.middlename,
        dob: params.dob,
        phone: params.phone,
        email: params.email,
        gender: params.gender,
      },
    );
  }

  /**
   * Verify NIN using phone number
   * Looks up NIN using the registered phone number
   */
  async verifyNINWithPhone(
    phone: string,
    params: VerificationParams,
  ): Promise<QoreidVerificationResponse> {
    this.logger.log(`Verifying NIN with phone: ${phone.substring(0, 4)}****`);

    return this.makeRequest<QoreidVerificationResponse>(
      'POST',
      `/v1/ng/identities/nin-phone/${phone}`,
      {
        firstname: params.firstname,
        lastname: params.lastname,
        middlename: params.middlename,
        dob: params.dob,
        email: params.email,
        gender: params.gender,
      },
    );
  }

  /**
   * Virtual NIN verification
   */
  async verifyVirtualNIN(
    vnin: string,
    params: VerificationParams,
  ): Promise<QoreidVerificationResponse> {
    this.logger.log(`Verifying Virtual NIN: ${vnin.substring(0, 4)}****`);

    return this.makeRequest<QoreidVerificationResponse>(
      'POST',
      `/v1/ng/identities/vnin/${vnin}`,
      {
        firstname: params.firstname,
        lastname: params.lastname,
        middlename: params.middlename,
        dob: params.dob,
        phone: params.phone,
        email: params.email,
        gender: params.gender,
      },
    );
  }

  // ============================================================================
  // BVN Verification
  // ============================================================================

  /**
   * BVN Boolean Match
   * Returns true/false for each field match
   */
  async verifyBVNMatch(
    bvn: string,
    params: VerificationParams,
  ): Promise<QoreidVerificationResponse> {
    this.logger.log(`Verifying BVN (match): ${bvn.substring(0, 4)}****`);

    return this.makeRequest<QoreidVerificationResponse>(
      'POST',
      `/v1/ng/identities/bvn-match/${bvn}`,
      {
        firstname: params.firstname,
        lastname: params.lastname,
        dob: params.dob,
        phone: params.phone,
        email: params.email,
        gender: params.gender,
      },
    );
  }

  /**
   * BVN Basic verification
   * Returns basic BVN information
   */
  async verifyBVNBasic(
    bvn: string,
    params: VerificationParams,
  ): Promise<QoreidVerificationResponse> {
    this.logger.log(`Verifying BVN (basic): ${bvn.substring(0, 4)}****`);

    return this.makeRequest<QoreidVerificationResponse>(
      'POST',
      `/v1/ng/identities/bvn-basic/${bvn}`,
      {
        firstname: params.firstname,
        lastname: params.lastname,
        dob: params.dob,
        phone: params.phone,
        email: params.email,
        gender: params.gender,
      },
    );
  }

  /**
   * BVN Premium verification
   * Returns comprehensive BVN data including photo
   */
  async verifyBVNPremium(
    bvn: string,
    params: VerificationParams,
  ): Promise<QoreidVerificationResponse> {
    this.logger.log(`Verifying BVN (premium): ${bvn.substring(0, 4)}****`);

    return this.makeRequest<QoreidVerificationResponse>(
      'POST',
      `/v1/ng/identities/bvn-premium/${bvn}`,
      {
        firstname: params.firstname,
        lastname: params.lastname,
        dob: params.dob,
        phone: params.phone,
        email: params.email,
        gender: params.gender,
      },
    );
  }

  // ============================================================================
  // Driver's License Verification
  // ============================================================================

  /**
   * Verify Driver's License
   */
  async verifyDriversLicense(
    licenseNumber: string,
    params: VerificationParams,
  ): Promise<QoreidVerificationResponse> {
    this.logger.log(`Verifying Driver's License: ${licenseNumber.substring(0, 4)}****`);

    return this.makeRequest<QoreidVerificationResponse>(
      'POST',
      `/v1/ng/identities/drivers-license/${licenseNumber}`,
      {
        firstname: params.firstname,
        lastname: params.lastname,
        dob: params.dob,
        phone: params.phone,
        email: params.email,
        gender: params.gender,
      },
    );
  }

  // ============================================================================
  // International Passport Verification
  // ============================================================================

  /**
   * Verify International Passport
   */
  async verifyPassport(
    passportNumber: string,
    params: VerificationParams,
  ): Promise<QoreidVerificationResponse> {
    this.logger.log(`Verifying Passport: ${passportNumber.substring(0, 4)}****`);

    return this.makeRequest<QoreidVerificationResponse>(
      'POST',
      `/v1/ng/identities/passport/${passportNumber}`,
      {
        firstname: params.firstname,
        lastname: params.lastname,
        dob: params.dob,
        phone: params.phone,
        email: params.email,
        gender: params.gender,
      },
    );
  }

  // ============================================================================
  // Voter's Card Verification
  // ============================================================================

  /**
   * Verify Voter's Card
   */
  async verifyVotersCard(
    vin: string,
    params: VerificationParams,
  ): Promise<QoreidVerificationResponse> {
    this.logger.log(`Verifying Voter's Card: ${vin.substring(0, 4)}****`);

    return this.makeRequest<QoreidVerificationResponse>(
      'POST',
      `/v1/ng/identities/voters-card/${vin}`,
      {
        firstname: params.firstname,
        lastname: params.lastname,
        dob: params.dob,
        phone: params.phone,
        email: params.email,
        gender: params.gender,
      },
    );
  }

  // ============================================================================
  // NUBAN Account Verification
  // ============================================================================

  /**
   * Verify NUBAN Bank Account
   */
  async verifyBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{
    accountNumber: string;
    accountName: string;
    bankCode: string;
  }> {
    this.logger.log(`Verifying Bank Account: ${accountNumber.substring(0, 4)}****`);

    return this.makeRequest<{
      accountNumber: string;
      accountName: string;
      bankCode: string;
    }>('POST', `/v1/ng/identities/nuban/${accountNumber}`, {
      bankCode,
    });
  }

  // ============================================================================
  // Business Verification
  // ============================================================================

  /**
   * Verify CAC (Corporate Affairs Commission) Registration
   */
  async verifyCACBasic(rcNumber: string): Promise<Record<string, unknown>> {
    this.logger.log(`Verifying CAC: ${rcNumber}`);

    return this.makeRequest<Record<string, unknown>>(
      'POST',
      `/v1/ng/identities/cac/${rcNumber}`,
      {},
    );
  }

  /**
   * Verify TIN (Tax Identification Number)
   */
  async verifyTIN(tin: string): Promise<Record<string, unknown>> {
    this.logger.log(`Verifying TIN: ${tin.substring(0, 4)}****`);

    return this.makeRequest<Record<string, unknown>>(
      'POST',
      `/v1/ng/identities/tin/${tin}`,
      {},
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if verification was successful
   */
  isVerificationSuccessful(response: QoreidVerificationResponse): boolean {
    return (
      response.status?.state === 'complete' &&
      response.status?.status === 'verified'
    );
  }

  /**
   * Get match percentage from verification response
   */
  getMatchPercentage(response: QoreidVerificationResponse): number {
    const summary = response.summary as Record<string, { status: string; fieldMatches: Record<string, boolean> } | undefined>;
    const checkType = Object.keys(summary)[0];

    if (!checkType || !summary[checkType]?.fieldMatches) {
      return 0;
    }

    const fieldMatches = summary[checkType]!.fieldMatches;
    const fields = Object.values(fieldMatches);
    const matchedFields = fields.filter((match) => match === true).length;

    return Math.round((matchedFields / fields.length) * 100);
  }
}

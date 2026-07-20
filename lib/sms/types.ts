export interface SmsConfig {
  id: number;
  provider: string;
  api_key: string;
  sender_id: string;
  route: string;
  environment: string;
  enabled: boolean;
  default_country_code: string;
  retry_count: number;
  timeout: number;
  delivery_report: boolean;
  created_at: string;
  updated_at: string;
}

export interface SmsProvider {
  readonly name: string;
  send(
    phone: string,
    message: string,
    config: SmsConfig
  ): Promise<{ success: boolean; error?: string; response?: any }>;
}

export interface SmsSendResult {
  success: boolean;
  error?: string;
  response?: any;
}

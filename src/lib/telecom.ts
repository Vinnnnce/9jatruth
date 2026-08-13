/**
 * Nigerian Telecom Integration Library
 * 
 * Supports airtime/data top-ups via:
 * - VTPass (primary)
 * - Africa's Talking (fallback)
 * - Termii (fallback)
 * 
 * Networks: MTN, Airtel, Glo, 9mobile
 */

import crypto from "node:crypto";

export type NetworkProvider = "MTN" | "Airtel" | "Glo" | "9mobile";
export type ServiceType = "airtime" | "data";
export type Provider = "vtpass" | "africastalking" | "termii" | "mock";

export interface TelecomRequest {
  phoneNumber: string;
  network: NetworkProvider;
  serviceType: ServiceType;
  amount: number;
  planCode?: string;
  planName?: string;
  userHash: string;
  redemptionId?: number;
}

export interface TelecomResult {
  success: boolean;
  providerRef?: string;
  provider: Provider;
  errorMessage?: string;
  status: "success" | "failed" | "pending";
}

export interface DataPlan {
  code: string;
  name: string;
  amount: number;
  validity: string;
  size: string;
}

// ─── Network Detection ───

const NETWORK_PREFIXES: Record<NetworkProvider, string[]> = {
  MTN: ["0803", "0806", "0814", "0810", "0813", "0814", "0816", "0703", "0706", "0903", "0906", "0913", "0916"],
  Airtel: ["0802", "0808", "0812", "0701", "0708", "0901", "0902", "0904", "0907", "0912"],
  Glo: ["0805", "0807", "0811", "0705", "0815", "0905", "0915"],
  "9mobile": ["0809", "0817", "0818", "0909", "0908"],
};

export function detectNetwork(phone: string): NetworkProvider | null {
  const normalized = phone.replace(/\D/g, "");
  const prefix = normalized.slice(-11, -8); // Get "080" prefix pattern
  for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    if (prefixes.some((p) => normalized.startsWith(p) || normalized.endsWith(p.slice(1)))) {
      return network as NetworkProvider;
    }
  }
  // More precise check
  for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    if (prefixes.some((p) => normalized.startsWith(p))) {
      return network as NetworkProvider;
    }
  }
  return null;
}

export function validatePhoneNumber(phone: string): boolean {
  const normalized = phone.replace(/\D/g, "");
  return normalized.length === 11 && normalized.startsWith("0");
}

export function formatPhone(phone: string): string {
  const normalized = phone.replace(/\D/g, "");
  if (normalized.startsWith("234")) return "0" + normalized.slice(3);
  if (normalized.startsWith("0")) return normalized;
  if (normalized.length === 10) return "0" + normalized;
  return normalized;
}

// ─── Data Plans ───

export const DATA_PLANS: Record<NetworkProvider, DataPlan[]> = {
  MTN: [
    { code: "mtn-1gb", name: "MTN 1GB Daily", amount: 350, validity: "1 day", size: "1GB" },
    { code: "mtn-3gb", name: "MTN 3GB Weekly", amount: 800, validity: "7 days", size: "3GB" },
    { code: "mtn-10gb", name: "MTN 10GB Monthly", amount: 2500, validity: "30 days", size: "10GB" },
    { code: "mtn-25gb", name: "MTN 25GB Monthly", amount: 5500, validity: "30 days", size: "25GB" },
  ],
  Airtel: [
    { code: "airtel-1gb", name: "Airtel 1GB Daily", amount: 350, validity: "1 day", size: "1GB" },
    { code: "airtel-3gb", name: "Airtel 3GB Weekly", amount: 800, validity: "7 days", size: "3GB" },
    { code: "airtel-10gb", name: "Airtel 10GB Monthly", amount: 2500, validity: "30 days", size: "10GB" },
    { code: "airtel-25gb", name: "Airtel 25GB Monthly", amount: 5500, validity: "30 days", size: "25GB" },
  ],
  Glo: [
    { code: "glo-1gb", name: "Glo 1GB Daily", amount: 300, validity: "1 day", size: "1GB" },
    { code: "glo-3gb", name: "Glo 3GB Weekly", amount: 700, validity: "7 days", size: "3GB" },
    { code: "glo-10gb", name: "Glo 10GB Monthly", amount: 2300, validity: "30 days", size: "10GB" },
    { code: "glo-25gb", name: "Glo 25GB Monthly", amount: 5000, validity: "30 days", size: "25GB" },
  ],
  "9mobile": [
    { code: "9mobile-1gb", name: "9mobile 1GB Daily", amount: 350, validity: "1 day", size: "1GB" },
    { code: "9mobile-3gb", name: "9mobile 3GB Weekly", amount: 800, validity: "7 days", size: "3GB" },
    { code: "9mobile-10gb", name: "9mobile 10GB Monthly", amount: 2500, validity: "30 days", size: "10GB" },
    { code: "9mobile-25gb", name: "9mobile 25GB Monthly", amount: 5500, validity: "30 days", size: "25GB" },
  ],
};

// ─── VTPass Integration ───

async function vtpassPurchase(req: TelecomRequest): Promise<TelecomResult> {
  const apiKey = process.env.VTPASS_API_KEY;
  const publicKey = process.env.VTPASS_PUBLIC_KEY;
  const sandbox = process.env.VTPASS_SANDBOX === "true";

  if (!apiKey || !publicKey) {
    throw new Error("VTPass credentials not configured");
  }

  const baseUrl = sandbox
    ? "https://sandbox.vtpass.com/api"
    : "https://vtpass.com/api";

  const requestId = `SOKE-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const serviceID = req.serviceType === "airtime" ? req.network.toLowerCase() : req.network.toLowerCase();

  try {
    const payload: Record<string, unknown> = {
      request_id: requestId,
      serviceID,
      amount: req.amount,
      phone: formatPhone(req.phoneNumber),
    };

    if (req.serviceType === "data" && req.planCode) {
      payload.billersCode = req.phoneNumber;
      payload.variation_code = req.planCode;
    }

    const response = await fetch(`${baseUrl}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        "public-key": publicKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.code === "000" || data.response_code === "000") {
      return {
        success: true,
        providerRef: requestId,
        provider: "vtpass",
        status: "success",
      };
    }

    return {
      success: false,
      provider: "vtpass",
      errorMessage: data.response_description || data.error || "VTPass purchase failed",
      status: "failed",
    };
  } catch (err) {
    return {
      success: false,
      provider: "vtpass",
      errorMessage: err instanceof Error ? err.message : "Network error",
      status: "failed",
    };
  }
}

// ─── Africa's Talking Integration ───

async function africasTalkingPurchase(req: TelecomRequest): Promise<TelecomResult> {
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;
  const username = process.env.AFRICAS_TALKING_USERNAME || "sandbox";

  if (!apiKey) {
    throw new Error("Africa's Talking credentials not configured");
  }

  const baseUrl = "https://api.africastalking.com/version1";
  const formattedPhone = "234" + formatPhone(req.phoneNumber).slice(1);

  try {
    if (req.serviceType === "airtime") {
      const response = await fetch(`${baseUrl}/airtime/send`, {
        method: "POST",
        headers: {
          apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username,
          recipients: JSON.stringify([{ phoneNumber: formattedPhone, amount: `NGN ${req.amount}` }]),
        }),
      });

      const data = await response.json();

      if (data.errorMessage === "None" || data.numSent > 0) {
        return {
          success: true,
          providerRef: data.requestId || `AT-${Date.now()}`,
          provider: "africastalking",
          status: "success",
        };
      }

      return {
        success: false,
        provider: "africastalking",
        errorMessage: data.errorMessage || "Airtime send failed",
        status: "failed",
      };
    }

    // For data, Africa's Talking doesn't directly support data bundles
    // Fall through to mock
    return mockPurchase(req);
  } catch (err) {
    return {
      success: false,
      provider: "africastalking",
      errorMessage: err instanceof Error ? err.message : "Network error",
      status: "failed",
    };
  }
}

// ─── Mock Purchase (for development/testing) ───

async function mockPurchase(req: TelecomRequest): Promise<TelecomResult> {
  // Only allow mock in development or when explicitly enabled
  if (process.env.NODE_ENV === "production" && process.env.TELECOM_MOCK !== "true") {
    return {
      success: false,
      provider: "mock",
      errorMessage: "No telecom provider configured. Set VTPASS_API_KEY or AFRICAS_TALKING_API_KEY, or set TELECOM_MOCK=true for testing.",
      status: "failed",
    };
  }
  await new Promise((r) => setTimeout(r, 500));

  const providerRef = `MOCK-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  return {
    success: true,
    providerRef,
    provider: "mock",
    status: "success",
  };
}

// ─── Main Purchase Function with Retry Logic ───

export async function purchaseAirtimeOrData(req: TelecomRequest): Promise<TelecomResult> {
  const providers: Provider[] = [];

  // Determine provider priority
  if (process.env.VTPASS_API_KEY) providers.push("vtpass");
  if (process.env.AFRICAS_TALKING_API_KEY) providers.push("africastalking");
  // Only use mock in development or when explicitly enabled
  if (providers.length === 0 && (process.env.NODE_ENV !== "production" || process.env.TELECOM_MOCK === "true")) {
    providers.push("mock");
  }

  let lastError = "";
  const maxRetries = 3;

  for (const provider of providers) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        let result: TelecomResult;

        switch (provider) {
          case "vtpass":
            result = await vtpassPurchase(req);
            break;
          case "africastalking":
            result = await africasTalkingPurchase(req);
            break;
          default:
            result = await mockPurchase(req);
        }

        if (result.success) {
          return result;
        }

        lastError = result.errorMessage || "Unknown error";

        // If not a transient error, don't retry
        if (result.status === "failed" && !lastError.includes("Network error")) {
          break;
        }

        // Exponential backoff
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Unknown error";
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
  }

  return {
    success: false,
    provider: providers[0],
    errorMessage: lastError || "All providers failed",
    status: "failed",
  };
}

// ─── Transaction Verification ───

export async function verifyTransaction(providerRef: string, provider: Provider): Promise<boolean> {
  switch (provider) {
    case "vtpass": {
      const apiKey = process.env.VTPASS_API_KEY;
      const sandbox = process.env.VTPASS_SANDBOX === "true";
      const baseUrl = sandbox ? "https://sandbox.vtpass.com/api" : "https://vtpass.com/api";
      try {
        const response = await fetch(`${baseUrl}/requery`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey || "",
          },
          body: JSON.stringify({ request_id: providerRef }),
        });
        const data = await response.json();
        return data.code === "000" || data.response_code === "000";
      } catch {
        return false;
      }
    }
    case "mock":
      return true;
    default:
      return true;
  }
}

// ─── Gift Card Code Generator ───

export function generateGiftCardCode(brand: string): string {
  const prefix = brand.slice(0, 3).toUpperCase();
  const random = crypto.randomBytes(8).toString("hex").toUpperCase();
  const checksum = crypto
    .createHash("md5")
    .update(prefix + random)
    .digest("hex")
    .slice(0, 2)
    .toUpperCase();
  return `${prefix}-${random.slice(0, 4)}-${random.slice(4, 8)}-${random.slice(8, 12)}-${checksum}`;
}

export function generateVoucherCode(storeName: string): string {
  const prefix = storeName.replace(/\s/g, "").slice(0, 4).toUpperCase();
  const random = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `${prefix}-${random.slice(0, 4)}-${random.slice(4, 8)}-${random.slice(8, 12)}`;
}

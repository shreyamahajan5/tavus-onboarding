"use server";

export type ApiError =
  | { type: "AUTH_ERROR"; message: string; developerMessage?: string }
  | { type: "NETWORK_ERROR"; message: string; developerMessage?: string }
  | { type: "RATE_LIMIT_ERROR"; message: string; developerMessage?: string }
  | { type: "VALIDATION_ERROR"; message: string; developerMessage?: string }
  | { type: "PAYMENT_ERROR"; message: string; developerMessage?: string }
  | { type: "UNKNOWN_ERROR"; message: string; developerMessage?: string };

export interface TavusResult {
  success: boolean;
  videoUrl?: string;
  videoId?: string;
  status?: string;
  error?: ApiError;
}

export async function generatePersonalExperience(
  name: string,
  companyName: string,
  templateScript?: string,
  options?: {
    background_url?: string;
    watermark_url?: string;
  }
): Promise<TavusResult> {
  const result = await generateTavusVideo(name, companyName, templateScript, options);
  return result;
}

/**
 * Server action to check the status of a specific video
 */
export async function getVideoStatus(videoId: string): Promise<TavusResult> {
  const apiKey = process.env.TAVUS_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: {
        type: "AUTH_ERROR",
        message: "API Key missing",
        developerMessage: "TAVUS_API_KEY not found in environment",
      },
    };
  }

  try {
    const response = await fetch(`https://tavusapi.com/v2/videos/${videoId}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: {
          type: "UNKNOWN_ERROR",
          message: `Status check failed: ${response.status}`,
          developerMessage: JSON.stringify(data),
        },
      };
    }

    return {
      success: true,
      status: data.status, // queued, processing, ready, failed
      videoUrl: data.hosted_url || data.video_url || "",
      videoId: data.video_id,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        type: "NETWORK_ERROR",
        message: "Failed to reach Tavus for status check",
        developerMessage: String(err),
      },
    };
  }
}

async function generateTavusVideo(
  name: string,
  companyName: string,
  templateScript?: string,
  options?: {
    background_url?: string;
    watermark_url?: string;
  }
): Promise<TavusResult> {
  const apiKey = process.env.TAVUS_API_KEY;
  const replicaId = process.env.REPLICA_ID || "r9d30b0e55ac";

  if (!apiKey) {
    return {
      success: false,
      error: {
        type: "AUTH_ERROR",
        message: "API Key missing from environment",
        developerMessage:
          "TAVUS_API_KEY is not defined in environment variables. Add it to .env.local and restart the dev server.",
      },
    };
  }

  const script = templateScript || `Hello ${name}. This is a personalized demo for ${companyName}. We are excited to show you the power of Tavus replicas. Let's build something amazing together!`;

  const payload = {
    replica_id: replicaId,
    script: script,
    video_name: `Interview-Demo-${name}-${companyName}`,
    background_url: options?.background_url,
    watermark_url: options?.watermark_url,
  };

  console.log('Sending Tavus Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch("https://tavusapi.com/v2/videos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Tavus API Error:', JSON.stringify(data, null, 2));

      if (response.status === 402) {
        return {
          success: false,
          error: {
            type: "PAYMENT_ERROR",
            message: "Tavus API quota exceeded or payment required",
            developerMessage: "The API returned a 402 error. Please check your Tavus billing settings."
          }
        };
      }

      return {
        success: false,
        error: {
          type: "UNKNOWN_ERROR",
          message: `Tavus API returned ${response.status}`,
          developerMessage: JSON.stringify(data),
        },
      };
    }

    return {
      success: true,
      status: data.status,
      videoUrl: data.hosted_url ?? data.video_url ?? "",
      videoId: data.video_id,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        type: "NETWORK_ERROR",
        message:
          "The server could not reach Tavus. Check your internet connection or the Tavus API URL.",
        developerMessage: String(err),
      },
    };
  }
}
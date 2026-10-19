export interface AIResponse {
  input_text: string;
  result: string;
  action: 'translate' | 'shorten' | 'formal' | 'friendly';
  source_lang: string | null;
  target_lang: string | null;
  correlation_id: string;
  mock: boolean;
}

export interface SummaryResponse {
  summary: string;
  decisions: string[];
  participants: string[];
  language: string;
  provider: string;
}

export interface STTResponse {
  transcript: string;
  recognized_text: string;
  summary?: string | null;
  language: string;
  provider: string;
}

export interface DocumentAnalysisResponse {
  filename?: string;
  summary: string;
  fields?: Record<string, string>;
  classification?: string;
}

const AI_API_BASE = (process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function requestAI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${AI_API_BASE}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    let message = `AI request failed: ${response.status}`;
    try {
      const body = await response.json();
      message = body?.error?.message || body?.detail || message;
      if (Array.isArray(message)) {
        message = message.map((item) => item.message || String(item)).join('; ');
      }
    } catch {
      // Keep the status-based message when the provider returns no JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const aiClient = {
  translate: (payload: {
    text: string;
    source_lang: string;
    target_lang: string;
  }) =>
    requestAI<AIResponse>('/translate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  assist: (payload: {
    text: string;
    action: 'shorten' | 'formal' | 'friendly';
    context?: string;
  }) =>
    requestAI<AIResponse>('/assist', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  summarize: (payload: {
    language: string;
    messages: Array<{ sender_id: string; text: string; timestamp?: string }>;
  }) =>
    requestAI<SummaryResponse>('/summary', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  transcribe: (file: File, language: string) => {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('language', language);
    return requestAI<STTResponse>('/stt', {
      method: 'POST',
      body: formData,
    });
  },

  analyzeDocument: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestAI<DocumentAnalysisResponse>('/document-analysis', {
      method: 'POST',
      body: formData,
    });
  },
};

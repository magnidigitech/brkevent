import { getDivisionHash } from './divisionHash';

/**
 * WhatsApp Helper Utilities & Message Templating
 * Standard WhatsApp formatting:
 * *bold* -> Bold
 * _italic_ -> Italic
 * ~strikethrough~ -> Strikethrough
 * ```monospace``` -> Monospace
 */

export const DEFAULT_WHATSAPP_TEMPLATE = `Namaste *{name}* garu 🙏,

You are cordially invited to the prestigious event hosted by *Sri Bhashyam Ramakrishna* garu.

📌 *Division Details:*
• *Division:* Division {division} ({party})
• *Principal Invitee:* {name}
• *Total Allowed:* *{allowance} Members* (including principal invitee)

🔗 *Your Digital Entry Pass:*
{url}

_Please present the above QR pass at the entrance gate for quick verification._
_Entry is strictly limited to {allowance} members._

Looking forward to your esteemed presence!
Warm Regards,
*Bhashyam Ramakrishna Team*`;

/**
 * Clean and format Indian phone number for WhatsApp wa.me links
 * e.g., "9397605656" -> "919397605656"
 * "+91 93976-05656" -> "919397605656"
 */
export function cleanPhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove spaces, hyphens, parentheses, plus signs
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return null;

  // If already 12 digits starting with 91 (e.g. 919397605656)
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }

  // If 10 digits (e.g. 9397605656) -> prepend Indian country code 91
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // If starts with 0 and length 11 (e.g. 09397605656) -> remove leading 0 and prepend 91
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }

  return digits;
}

export interface WardMessageContext {
  ward_number: number;
  candidate_name: string;
  party: string;
  allowance?: number;
  total_entered?: number;
  remaining_allowance?: number;
  phone?: string | null;
}

/**
 * Format a WhatsApp message using template variables
 */
export function formatWhatsAppMessage(
  template: string,
  ward: WardMessageContext,
  domain: string = 'https://event.bhashyamramakrishna.in'
): string {
  const hash = getDivisionHash(ward.ward_number);
  const url = `${domain.replace(/\/$/, '')}/division${ward.ward_number}-${hash}`;
  const allowance = ward.allowance ?? 5;
  const entered = ward.total_entered ?? 0;
  const status = entered > 0 ? `${entered} entered` : 'Not yet entered';

  let msg = template;

  // Replace placeholders: support both {var} and {{var}} for division and legacy ward
  const replacements: Record<string, string> = {
    name: ward.candidate_name,
    candidate_name: ward.candidate_name,
    division: String(ward.ward_number),
    division_number: String(ward.ward_number),
    ward: String(ward.ward_number),
    ward_number: String(ward.ward_number),
    party: ward.party,
    allowance: String(allowance),
    url: url,
    entered: String(entered),
    status: status,
  };

  Object.entries(replacements).forEach(([key, val]) => {
    const regex1 = new RegExp(`\\{${key}\\}`, 'gi');
    const regex2 = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    msg = msg.replace(regex1, val).replace(regex2, val);
  });

  return msg;
}

/**
 * Generate full wa.me link
 */
export function generateWhatsAppUrl(phone: string, message: string): string {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return '';
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

/**
 * Get active WhatsApp template from localStorage or fallback to default
 */
export function getSavedWhatsAppTemplate(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('brk_whatsapp_template');
    if (stored && stored.trim().length > 0) {
      return stored;
    }
  }
  return DEFAULT_WHATSAPP_TEMPLATE;
}

/**
 * Convert WhatsApp formatted text (*bold*, _italic_, ~strike~, ```code```) to sanitized HTML for live preview
 */
export function formatWhatsAppPreviewHtml(text: string): string {
  if (!text) return '';

  // Escape HTML tags to prevent XSS
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Monospace: ```text```
  escaped = escaped.replace(/```([\s\S]*?)```/g, '<code class="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-xs font-mono">$1</code>');

  // Bold: *text* (word boundaries or spaces)
  escaped = escaped.replace(/(^|[\s\(\[\{])\*([^\*\n]+?)\*([\s\)\]\}\.,:;!?]|$)/g, '$1<strong class="font-bold text-slate-950">$2</strong>$3');

  // Italic: _text_
  escaped = escaped.replace(/(^|[\s\(\[\{])_([^_\n]+?)_([\s\)\]\}\.,:;!?]|$)/g, '$1<em class="italic text-slate-800">$2</em>$3');

  // Strikethrough: ~text~
  escaped = escaped.replace(/(^|[\s\(\[\{])~([^~\n]+?)~([\s\)\]\}\.,:;!?]|$)/g, '$1<del class="line-through text-slate-500">$2</del>$3');

  // URLs: https://...
  escaped = escaped.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-semibold break-all hover:text-blue-800">$1</a>'
  );

  // New lines
  escaped = escaped.replace(/\n/g, '<br/>');

  return escaped;
}

/**
 * Save WhatsApp template to localStorage
 */
export function saveWhatsAppTemplateLocal(template: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('brk_whatsapp_template', template);
  }
}


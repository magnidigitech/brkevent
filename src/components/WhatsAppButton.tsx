'use client';

import React from 'react';
import { MessageSquare, ExternalLink } from 'lucide-react';
import {
  generateWhatsAppUrl,
  formatWhatsAppMessage,
  getSavedWhatsAppTemplate,
  cleanPhoneNumber,
  WardMessageContext,
} from '@/lib/utils/whatsapp';

interface WhatsAppButtonProps {
  ward: WardMessageContext;
  phone?: string | null;
  template?: string;
  variant?: 'icon' | 'pill' | 'button' | 'full';
  className?: string;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  ward,
  phone: overridePhone,
  template,
  variant = 'pill',
  className = '',
}) => {
  const activePhone = overridePhone || ward.phone;
  const cleaned = cleanPhoneNumber(activePhone);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cleaned) return;

    const activeTemplate = template || getSavedWhatsAppTemplate();
    const message = formatWhatsAppMessage(activeTemplate, ward);
    const url = generateWhatsAppUrl(cleaned, message);

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!cleaned) {
    return null;
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={`Send WhatsApp message to ${ward.candidate_name}`}
        className={`p-1.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#075E54] transition border border-[#25D366]/25 shadow-[0_1px_2px_rgba(0,0,0,0.02)] active:scale-95 ${className}`}
        aria-label="Send WhatsApp Message"
      >
        <MessageSquare className="w-3.5 h-3.5 fill-[#25D366] text-[#25D366]" />
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={`Send WhatsApp message to ${ward.candidate_name}`}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#25D366]/12 hover:bg-[#25D366]/20 text-[#075E54] font-medium text-xs transition border border-[#25D366]/25 shadow-[0_1px_2px_rgba(0,0,0,0.02)] active:scale-95 ${className}`}
      >
        <MessageSquare className="w-3 h-3 fill-[#25D366] text-[#25D366]" />
        <span>WhatsApp</span>
      </button>
    );
  }

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`w-full py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-medium text-sm shadow-[0_2px_8px_rgba(37,211,102,0.25)] transition flex items-center justify-center gap-2 active:scale-[0.99] ${className}`}
      >
        <MessageSquare className="w-4 h-4 fill-white text-white" />
        <span>Send WhatsApp Invitation</span>
        <ExternalLink className="w-3.5 h-3.5 text-white/80 ml-auto" />
      </button>
    );
  }

  // Default 'button'
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#075E54] font-medium text-xs border border-[#25D366]/25 shadow-2xs transition active:scale-95 ${className}`}
    >
      <MessageSquare className="w-3.5 h-3.5 fill-[#25D366] text-[#25D366]" />
      <span>Send WhatsApp</span>
    </button>
  );
};

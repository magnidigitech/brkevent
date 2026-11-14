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
        className={`p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 transition border border-emerald-200/80 shadow-2xs ${className}`}
        aria-label="Send WhatsApp Message"
      >
        <MessageSquare className="w-4 h-4 fill-emerald-600 text-emerald-600" />
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={`Send WhatsApp message to ${ward.candidate_name}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition active:scale-95 ${className}`}
      >
        <MessageSquare className="w-3.5 h-3.5 fill-white" />
        <span>WhatsApp</span>
      </button>
    );
  }

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs transition flex items-center justify-center gap-2 active:scale-98 ${className}`}
      >
        <MessageSquare className="w-4 h-4 fill-white" />
        <span>Send WhatsApp Invitation</span>
        <ExternalLink className="w-3.5 h-3.5 text-emerald-200 ml-auto" />
      </button>
    );
  }

  // Default 'button'
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition active:scale-95 ${className}`}
    >
      <MessageSquare className="w-3.5 h-3.5 fill-white" />
      <span>Send WhatsApp</span>
    </button>
  );
};


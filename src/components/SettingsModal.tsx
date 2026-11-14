'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Settings,
  MessageSquare,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Check,
  RefreshCw,
  Send,
  Sparkles,
  Phone,
  Eye,
  RotateCcw,
  CheckCheck
} from 'lucide-react';
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  getSavedWhatsAppTemplate,
  saveWhatsAppTemplateLocal,
  formatWhatsAppMessage,
  formatWhatsAppPreviewHtml,
  cleanPhoneNumber,
  generateWhatsAppUrl,
  WardMessageContext
} from '@/lib/utils/whatsapp';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (newTemplate: string) => void;
}

const SAMPLE_WARD: WardMessageContext = {
  ward_number: 31,
  candidate_name: 'GANTA VENKATA MOULIKA',
  party: 'TDP',
  allowance: 5,
  total_entered: 0,
  remaining_allowance: 5,
  phone: '6302552079',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [template, setTemplate] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [testPhone, setTestPhone] = useState<string>('9397605656');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // First load from localStorage or server
      const local = getSavedWhatsAppTemplate();
      setTemplate(local);

      // Also try fetching from API to sync
      fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.settings?.whatsapp_template) {
            setTemplate(data.settings.whatsapp_template);
            saveWhatsAppTemplateLocal(data.settings.whatsapp_template);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Insert formatted text or wrapper at cursor
  const insertFormatting = (prefix: string, suffix: string = prefix, defaultPlaceholder: string = 'text') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = template.substring(start, end) || defaultPlaceholder;

    const replacement = `${prefix}${selectedText}${suffix}`;
    const newText = template.substring(0, start) + replacement + template.substring(end);

    setTemplate(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 10);
  };

  const insertVariable = (variableTag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = template.substring(0, start) + variableTag + template.substring(end);

    setTemplate(newText);

    setTimeout(() => {
      textarea.focus();
      const nextPos = start + variableTag.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 10);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      saveWhatsAppTemplateLocal(template);

      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_template: template }),
      });

      setSavedSuccess(true);
      if (onSaved) onSaved(template);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = () => {
    if (window.confirm('Reset WhatsApp message template back to default pattern?')) {
      setTemplate(DEFAULT_WHATSAPP_TEMPLATE);
    }
  };

  const handleSendTest = () => {
    const cleaned = cleanPhoneNumber(testPhone);
    if (!cleaned) {
      alert('Please enter a valid 10-digit phone number for testing.');
      return;
    }
    const message = formatWhatsAppMessage(template, SAMPLE_WARD);
    const url = generateWhatsAppUrl(cleaned, message);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Preview formatted text
  const renderedMessage = formatWhatsAppMessage(template, SAMPLE_WARD);
  const previewHtml = formatWhatsAppPreviewHtml(renderedMessage);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg">Event Settings</h2>
              <p className="text-xs text-slate-400">Configure WhatsApp message pattern & formatting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher for mobile */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'editor'
                ? 'border-amber-500 text-slate-900 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Message Template Pattern</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'preview'
                ? 'border-amber-500 text-slate-900 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-blue-600" />
            <span>Live WhatsApp Preview</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {activeTab === 'editor' ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <span>Default WhatsApp Invitation Pattern</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleResetDefault}
                    className="text-[11px] font-bold text-slate-500 hover:text-rose-600 transition flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset to Default</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  Staff can send this invitation to corporators in one tap. Use the buttons below to apply bold, italic, or insert dynamic ward details.
                </p>

                {/* WhatsApp Formatting Toolbar */}
                <div className="p-2 bg-slate-100 rounded-xl border border-slate-200 flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                    Format:
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => insertFormatting('*', '*', 'bold text')}
                    className="p-1.5 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1 shadow-2xs"
                    title="Bold (*text*)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Bold</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => insertFormatting('_', '_', 'italic text')}
                    className="p-1.5 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 italic text-xs flex items-center gap-1 shadow-2xs"
                    title="Italic (_text_)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Italic</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => insertFormatting('~', '~', 'strike text')}
                    className="p-1.5 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs flex items-center gap-1 shadow-2xs"
                    title="Strikethrough (~text~)"
                  >
                    <Strikethrough className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Strike</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => insertFormatting('```', '```', 'code text')}
                    className="p-1.5 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs flex items-center gap-1 shadow-2xs font-mono"
                    title="Monospace (```text```)"
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Mono</span>
                  </button>

                  <div className="h-4 w-px bg-slate-300 mx-1" />

                  {/* Emojis */}
                  <div className="flex items-center gap-1">
                    {['🙏', '🤝', '📌', '🔗', '📅', '⏰', '🚲', '🪷'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertVariable(emoji)}
                        className="px-1.5 py-0.5 rounded-md hover:bg-slate-200 text-sm transition"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Variable Pills Toolbar */}
                <div className="p-2 bg-amber-50/70 rounded-xl border border-amber-200/80 mb-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Insert Dynamic Placeholders:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '{name}', label: 'Invitee Name' },
                      { tag: '{ward}', label: 'Ward #' },
                      { tag: '{party}', label: 'Party' },
                      { tag: '{allowance}', label: 'Allowance (5)' },
                      { tag: '{url}', label: 'Pass URL' },
                      { tag: '{status}', label: 'Entry Status' },
                    ].map((item) => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => insertVariable(item.tag)}
                        className="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-amber-950 font-bold text-xs shadow-2xs transition active:scale-95"
                      >
                        + {item.tag} <span className="text-[10px] font-normal text-amber-700">({item.label})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={9}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full p-3 font-mono text-xs sm:text-sm bg-white border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed shadow-inner"
                  placeholder="Enter message pattern..."
                />
              </div>

              {/* Quick Test Sending */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Test Number:</span>
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="10-digit number"
                    className="w-full sm:w-40 px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendTest}
                  className="w-full sm:w-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test via WhatsApp</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live WhatsApp Preview */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold text-slate-700">Sample Ward: Ward 31 ({SAMPLE_WARD.candidate_name})</span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  WhatsApp Preview
                </span>
              </div>

              {/* Realistic WhatsApp Chat Bubble Container */}
              <div className="rounded-2xl p-4 bg-[#EFEAE2] border border-[#DDD6CE] min-h-[300px] flex flex-col justify-end">
                <div className="max-w-[92%] sm:max-w-[85%] bg-white rounded-2xl rounded-tl-none p-3.5 shadow-sm border border-slate-200/80 text-xs sm:text-sm text-slate-900 leading-relaxed relative">
                  
                  {/* Rendered HTML */}
                  <div
                    className="break-words space-y-1"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />

                  {/* WhatsApp Time & Checkmarks footer */}
                  <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-400">
                    <span>12:00 PM</span>
                    <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  This preview renders exactly as your corporators will see it on their mobile WhatsApp screen.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
          {savedSuccess ? (
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
              <Check className="w-4 h-4" />
              <span>Settings saved successfully!</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">Changes apply to all WhatsApp invitation links</span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-white transition"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Pattern</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};


import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, X, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { verifyPasscode, unlockModule, getAppSettings } from '@/lib/app-settings';

export interface PasscodeLockProps {
  moduleName: string;
  onUnlock: () => void;
  onClose?: () => void;
}

export function PasscodeLock({ moduleName, onUnlock, onClose }: PasscodeLockProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const handleDigit = useCallback(
    (digit: string) => {
      if (isVerifying) return;
      if (pin.length < 4) {
        setError('');
        const nextPin = pin + digit;
        setPin(nextPin);
      }
    },
    [pin, isVerifying]
  );

  const handleDelete = useCallback(() => {
    if (isVerifying) return;
    setError('');
    setPin((prev) => prev.slice(0, -1));
  }, [isVerifying]);

  const verifyEnteredPin = useCallback(
    async (codeToVerify: string) => {
      setIsVerifying(true);
      setError('');

      try {
        let masterPasscode: string | null = null;

        if (isSupabaseConfigured()) {
          const { data, error: sbError } = await supabase
            .from('app_settings')
            .select('master_passcode')
            .limit(1)
            .maybeSingle();

          if (!sbError && data?.master_passcode) {
            masterPasscode = data.master_passcode;
          }
        }

        // Fallback to local app settings if not fetched from Supabase
        if (!masterPasscode) {
          const settings = await getAppSettings();
          masterPasscode = settings.master_passcode || null;
        }

        if (!masterPasscode) {
          // If no passcode is configured, unlock automatically
          unlockModule(moduleName);
          onUnlock();
          return;
        }

        const isValid = await verifyPasscode(codeToVerify, masterPasscode);

        if (isValid) {
          unlockModule(moduleName);
          onUnlock();
        } else {
          setIsShaking(true);
          setError('Incorrect passcode');
          setTimeout(() => {
            setIsShaking(false);
            setPin('');
          }, 600);
        }
      } catch (err) {
        console.error('[PasscodeLock] Verification error:', err);
        setError('Error verifying passcode. Please try again.');
        setPin('');
      } finally {
        setIsVerifying(false);
      }
    },
    [moduleName, onUnlock]
  );

  // Trigger verification as soon as 4 digits are typed
  useEffect(() => {
    if (pin.length === 4) {
      void verifyEnteredPin(pin);
    }
  }, [pin, verifyEnteredPin]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDelete, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-[340px] rounded-3xl bg-[#1d1d23] border border-white/10 p-6 shadow-2xl flex flex-col items-center select-none ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        {/* Optional close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Icon */}
        <div className="mt-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary border border-primary/30 shadow-lg shadow-primary/10">
          <Lock className="h-7 w-7 text-primary" />
        </div>

        {/* Title */}
        <h2 className="mt-4 text-center text-lg font-semibold text-white">
          Enter Master Passcode
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Enter 4-digit passcode to access <span className="text-white font-medium">{moduleName}</span>
        </p>

        {/* 4 Circle indicators */}
        <div className="my-6 flex items-center justify-center gap-4">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`h-4 w-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-primary border-2 border-primary scale-110 shadow-[0_0_12px_rgba(59,130,246,0.8)]'
                    : 'border-2 border-slate-600 bg-transparent'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        <div className="h-5 mb-2 flex items-center justify-center text-center">
          {error ? (
            <span className="flex items-center gap-1 text-xs font-medium text-rose-400 animate-in fade-in">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </span>
          ) : isVerifying ? (
            <span className="text-xs text-slate-400 animate-pulse">Verifying passcode...</span>
          ) : null}
        </div>

        {/* Number Pad (iPhone style) */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[270px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isVerifying}
              onClick={() => handleDigit(num)}
              className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-white/[0.05] border border-white/5 text-xl font-medium text-white transition-all hover:bg-white/[0.12] active:scale-95 active:bg-white/[0.2] disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {num}
            </button>
          ))}

          {/* Bottom row: Cancel / 0 / Delete */}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              disabled={isVerifying}
              className="flex h-16 w-16 mx-auto items-center justify-center rounded-full text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-all hover:bg-white/[0.08] active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
          ) : (
            <div className="h-16 w-16 mx-auto" />
          )}

          <button
            type="button"
            disabled={isVerifying}
            onClick={() => handleDigit('0')}
            className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-white/[0.05] border border-white/5 text-xl font-medium text-white transition-all hover:bg-white/[0.12] active:scale-95 active:bg-white/[0.2] disabled:opacity-50 cursor-pointer shadow-sm"
          >
            0
          </button>

          <button
            type="button"
            disabled={isVerifying || pin.length === 0}
            onClick={handleDelete}
            aria-label="Delete"
            className="flex h-16 w-16 mx-auto items-center justify-center rounded-full text-slate-400 hover:text-white transition-all hover:bg-white/[0.08] active:scale-95 disabled:opacity-30 cursor-pointer"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PasscodeLock;

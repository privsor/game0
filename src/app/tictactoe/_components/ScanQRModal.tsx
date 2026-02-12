"use client";

import React, { useEffect, useRef, useState, memo } from "react";
import { Html5Qrcode } from "html5-qrcode";

type ScanQRModalProps = {
  onClose: () => void;
  onScanSuccess: (roomCode: string) => void;
};

function ScanQRModalImpl({ onClose, onScanSuccess }: ScanQRModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const hasScannedRef = useRef(false);
  const isRunningRef = useRef(false);

  useEffect(() => {
    const scannerId = "qr-reader";
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    const qrCodeSuccessCallback = (decodedText: string) => {
      if (hasScannedRef.current) return;
      
      // Extract room code from URL
      try {
        const url = new URL(decodedText);
        const roomCode = url.searchParams.get("room");
        if (roomCode) {
          hasScannedRef.current = true;
          // Stop scanner before calling callback
          scanner
          .stop()
          .then(() => {
            isRunningRef.current = false;
          })
          .catch(() => {});
        onScanSuccess(roomCode.toUpperCase());
        }
      } catch {
        // Not a valid URL, ignore and continue scanning
      }
    };

    const qrCodeErrorCallback = () => {
      // Normal scanning errors, ignore
    };

    // Start scanning
    scanner
      .start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      )
      .then(() => {
        setIsStarting(false);
        isRunningRef.current = true;
      })
      .catch((err) => {
        setIsStarting(false);
        isRunningRef.current = false;
        setError("Camera access denied or not available. Please check permissions.");
        // eslint-disable-next-line no-console
        console.error("QR Scanner error:", err);
      });

    return () => {
      if (scannerRef.current && isRunningRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
        isRunningRef.current = false;
      }
    };
  }, [onScanSuccess]);

  const handleClose = () => {
    if (scannerRef.current && isRunningRef.current) {
      scannerRef.current.stop().catch(() => {});
      isRunningRef.current = false;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="w-full max-w-md mx-4">
        <div className="rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-xl">
          <h2 className="text-xl font-bold mb-1 text-center">Scan Room QR Code</h2>
          <p className="text-white/60 text-sm mb-4 text-center">
            Point your camera at a room QR code to join
          </p>

          <div className="relative mb-4">
            {/* Scanner container */}
            <div
              id="qr-reader"
              className="rounded-lg overflow-hidden bg-black"
              style={{ minHeight: "300px" }}
            />

            {/* Loading state */}
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 rounded-lg">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-white/60 text-sm">Starting camera...</span>
                </div>
              </div>
            )}

            {/* Scan overlay - corner brackets */}
            {!isStarting && !error && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-[250px] h-[250px]">
                  {/* Top-left corner */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-white/80 rounded-tl-lg" />
                  {/* Top-right corner */}
                  <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-white/80 rounded-tr-lg" />
                  {/* Bottom-left corner */}
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-white/80 rounded-bl-lg" />
                  {/* Bottom-right corner */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-white/80 rounded-br-lg" />
                </div>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={handleClose}
              className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ScanQRModal = memo(ScanQRModalImpl);

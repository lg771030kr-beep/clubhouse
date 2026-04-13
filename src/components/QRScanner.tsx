import React, { useEffect, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // html5-qrcode 인스턴스 생성
    const html5QrCode = new Html5Qrcode("qr-reader");

    const config = { 
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: window.innerHeight / window.innerWidth,
      formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
    };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        // 성공 시 스캐너를 중지하고 부모 컴포넌트에 텍스트 전달
        if (html5QrCode.isScanning) {
          html5QrCode.stop().then(() => {
            onScanSuccess(decodedText);
          }).catch(err => console.error("스캐너 중지 실패", err));
        }
      },
      (errorMessage) => {
        // 스캔 실패는 지속적으로 발생하므로 무시
      }
    ).catch((err) => {
      console.error(err);
      setError('카메라 접근 권한이 없거나 기기에서 지원하지 않습니다.');
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <h2 className="text-white font-bold text-lg">QR 출석 스캔</h2>
        <button 
          onClick={onClose}
          className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera Feed Container */}
      <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
        <div id="qr-reader" className="w-full h-full object-cover"></div>
        
        {/* Custom Overlay for Guide Box */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="custom-qr-overlay">
            {/* Corner highlights */}
            <div className="absolute top-[-2px] left-[-2px] w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl"></div>
            <div className="absolute top-[-2px] right-[-2px] w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl"></div>
            <div className="absolute bottom-[-2px] left-[-2px] w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl"></div>
            <div className="absolute bottom-[-2px] right-[-2px] w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-2xl"></div>
          </div>
        </div>
      </div>

      {/* Footer Instructions */}
      <div className="absolute bottom-12 left-0 right-0 px-6 text-center z-10">
        <div className="bg-black/60 backdrop-blur-md text-white px-6 py-3 rounded-full text-sm font-medium inline-block shadow-lg border border-white/10 animate-pulse">
          사각형 가이드 안에 QR 코드를 맞춰주세요
        </div>
        {error && (
          <div className="mt-4 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm shadow-lg max-w-xs mx-auto">
            {error}
          </div>
        )}
      </div>

      <style>{`
        #qr-reader {
          border: none !important;
        }
        #qr-reader img {
          object-fit: cover !important;
        }
        /* Hide html5-qrcode default UI elements */
        #qr-reader__dashboard_section_csr span,
        #qr-reader__dashboard_section_swaplink {
          display: none !important;
        }
        /* Overlay styles */
        .custom-qr-overlay {
          box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.5);
          width: 250px;
          height: 250px;
          border-radius: 20px;
          position: relative;
        }
      `}</style>
    </div>
  );
}

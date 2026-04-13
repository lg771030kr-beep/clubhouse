import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentTitle: string;
}

export const SubmissionModal: React.FC<SubmissionModalProps> = ({ isOpen, onClose, assignmentTitle }) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setIsDone(true);
      setTimeout(() => {
        onClose();
        setIsDone(false);
        setContent('');
      }, 1500);
    }, 1000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            {isDone ? (
              <div className="p-12 flex flex-col items-center text-center gap-4">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">제출 완료!</h3>
                <p className="text-slate-500">과제가 성공적으로 제출되었습니다.</p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">과제 제출</h3>
                    <p className="text-sm text-slate-500 mt-1">{assignmentTitle}</p>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <X size={20} className="text-slate-500" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      내용 작성
                    </label>
                    <textarea
                      required
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="과제에 대한 설명을 입력하세요..."
                      className="w-full h-32 p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none resize-none text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Upload size={16} className="text-blue-600" />
                      파일 첨부 (선택)
                    </label>
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group">
                      <Upload size={24} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                      <p className="text-xs text-slate-500 font-medium">클릭하거나 파일을 드래그하세요</p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      '제출하기'
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

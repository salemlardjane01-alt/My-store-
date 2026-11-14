import React, { useState, useRef } from 'react';
import { uploadProductImageDetailed, deleteProductImageByUrl } from '../../firebase';
import { Upload, Trash2, ArrowUp, ArrowDown, Loader2, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface ProductDetailImagesUploadProps {
  detailImages: string[];
  setDetailImages: (urls: string[]) => void;
}

export const ProductDetailImagesUpload: React.FC<ProductDetailImagesUploadProps> = ({
  detailImages = [],
  setDetailImages
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const uploadFiles = async (files: FileList) => {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadError(null);
    setStorageWarning(null);
    const uploadedUrls: string[] = [];
    const failedNames: string[] = [];
    let fallbackReason: string | undefined;

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setProgressMsg(`جاري رفع: ${file.name} (${i + 1}/${validFiles.length})`);
      try {
        const result = await uploadProductImageDetailed(file);
        if (result.url) {
          uploadedUrls.push(result.url);
        }
        if (result.usedFallback && !fallbackReason) {
          fallbackReason = result.errorReason || 'Storage fallback';
        }
      } catch (err) {
        console.error("Error uploading detail image:", file.name, err);
        failedNames.push(file.name);
      }
    }

    if (failedNames.length > 0) {
      setUploadError(`فشل رفع الصور التفصيلية التالية: ${failedNames.join('، ')}`);
    }
    if (fallbackReason) {
      setStorageWarning(
        `تم تجهيز الصور التفصيلية وإرفاقها عبر الضغط الذكي داخل قاعدة البيانات (Firebase Storage غير مفعّل بعد: ${fallbackReason}). يمكنك حفظ المنتج بشكل طبيعي.`
      );
    }

    if (uploadedUrls.length > 0) {
      setDetailImages([...detailImages, ...uploadedUrls]);
    }
    setUploading(false);
    setProgressMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  const removeDetailImage = async (urlToRemove: string, indexToRemove: number) => {
    const updated = detailImages.filter((_, idx) => idx !== indexToRemove);
    setDetailImages(updated);
    try {
      await deleteProductImageByUrl(urlToRemove);
    } catch (err) {
      console.warn("Could not delete from storage bucket:", err);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...detailImages];
    const temp = copy[index];
    copy[index] = copy[index - 1];
    copy[index - 1] = temp;
    setDetailImages(copy);
  };

  const moveDown = (index: number) => {
    if (index === detailImages.length - 1) return;
    const copy = [...detailImages];
    const temp = copy[index];
    copy[index] = copy[index + 1];
    copy[index + 1] = temp;
    setDetailImages(copy);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-neutral-50 px-3 py-2.5 rounded-xl border border-neutral-100">
        <span className="text-[14px] font-semibold text-brand-text flex items-center gap-2">
          <ImageIcon size={18} className="text-neutral-400" />
          صور شرح وتفاصيل المنتج (Product Detail Images)
        </span>
        <span className="text-[11px] text-neutral-400 font-mono">
          {detailImages.length} صور تفصيلية مضافة
        </span>
      </div>

      {/* Drag & Drop Upload Space */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2.5 ${
          dragActive 
            ? 'border-neutral-800 bg-neutral-50 scale-[0.99]' 
            : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50/50 bg-white'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*"
          onChange={handleChange}
        />
        
        <div className="p-2.5 bg-neutral-100 rounded-full text-neutral-600 transition-transform">
          <Upload size={20} className="text-brand-text" />
        </div>
        
        <div>
          <p className="text-[13px] font-medium text-brand-text font-sans">
            اسحب صور تفاصيل المنتج هنا، أو اضغط للتصفح من جهازك
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            تُعرض هذه الصور بالتسلسل أسفل نموذج الطلب في صفحة المنتج (مثال: AliExpress)
          </p>
        </div>
      </div>

      {/* Uploading indicator */}
      {uploading && (
        <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/50 flex items-center gap-2.5 animate-pulse">
          <Loader2 size={16} className="animate-spin text-brand-text shrink-0" />
          <span className="text-[12px] font-medium text-neutral-600 font-sans">
            {progressMsg || 'جاري رفع الصور ومعالجة الملفات...'}
          </span>
        </div>
      )}

      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-[12px] font-medium flex items-start gap-2" dir="rtl">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}

      {storageWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11.5px] font-medium flex items-start gap-2" dir="rtl">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{storageWarning}</span>
        </div>
      )}

      {/* Drag Reordering & Previews List */}
      {detailImages.length > 0 ? (
        <div className="space-y-2 min-h-20 max-h-[360px] overflow-y-auto pr-1">
          {detailImages.map((url, idx) => (
            <div 
              key={url + '-' + idx} 
              className="flex items-center gap-3.5 bg-neutral-50 rounded-xl border border-neutral-200/55 p-2.5 hover:bg-neutral-100/50 transition-colors"
            >
              <div className="w-12 h-14 bg-neutral-200 rounded-lg overflow-hidden shrink-0 border border-neutral-200 flex items-center justify-center">
                <img 
                  src={url} 
                  alt={`Detail thumb ${idx + 1}`} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-bold text-neutral-700 block">الصورة التفصيلية {idx + 1}</span>
                <span className="text-[10px] text-neutral-400 font-mono truncate block max-w-xs">{url}</span>
              </div>

              {/* Order Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="نقل لأعلى"
                  disabled={idx === 0}
                  onClick={() => moveUp(idx)}
                  className="p-1.5 hover:bg-white rounded-lg text-neutral-500 hover:text-black disabled:opacity-30 disabled:hover:bg-transparent transition-colors border border-transparent hover:border-neutral-200"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  title="نقل لأسفل"
                  disabled={idx === detailImages.length - 1}
                  onClick={() => moveDown(idx)}
                  className="p-1.5 hover:bg-white rounded-lg text-neutral-500 hover:text-black disabled:opacity-30 disabled:hover:bg-transparent transition-colors border border-transparent hover:border-neutral-200"
                >
                  <ArrowDown size={14} />
                </button>
                <div className="w-px h-6 bg-neutral-200 mx-1" />
                <button
                  type="button"
                  title="حذف الصورة"
                  onClick={() => removeDetailImage(url, idx)}
                  className="p-1.5 hover:bg-red-50 hover:border-red-200 rounded-lg text-neutral-400 hover:text-red-600 transition-colors border border-transparent"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-6 bg-neutral-50/50 rounded-2xl border border-neutral-100 text-neutral-400 text-center">
          <ImageIcon size={26} className="text-neutral-300 stroke-[1.5] mb-1.5" />
          <p className="text-[12px] font-medium leading-relaxed">لا توجد صور شرح كولاج للمنتج</p>
          <p className="text-[11px] text-neutral-450">ارفع صوراً طويلة أو رسومات تفصيلية لشرح تفاصيل ومميزات المنتج ومقاساته بدقة للعميل</p>
        </div>
      )}
    </div>
  );
};

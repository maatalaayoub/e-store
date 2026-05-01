"use client";

import { useRef } from "react";
import { Star, Trash2, Upload, ImageIcon } from "lucide-react";

/**
 * ImageManager
 *
 * Handles both staged (new, not yet uploaded) images and existing DB images.
 *
 * Props:
 *   existingImages  – array from DB: { id, url, is_main, display_order }
 *   pendingImages   – array of { file, preview, isMain }
 *   onAddPending    – fn(files: FileList)
 *   onRemovePending – fn(index: number)
 *   onSetPendingMain– fn(index: number)
 *   onRemoveExisting– fn(imageId: string)
 *   onSetExistingMain–fn(imageId: string)
 */
export default function ImageManager({
  existingImages = [],
  pendingImages = [],
  onAddPending,
  onRemovePending,
  onSetPendingMain,
  onRemoveExisting,
  onSetExistingMain,
}) {
  const inputRef = useRef(null);
  const hasMain =
    existingImages.some((img) => img.is_main) ||
    pendingImages.some((img) => img.isMain);

  const handleFiles = (e) => {
    if (e.target.files?.length) onAddPending(e.target.files);
    // reset so same file can be re-selected
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Existing images */}
      {existingImages.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            Saved images
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {existingImages.map((img) => (
              <div
                key={img.id}
                className={`relative group rounded-lg overflow-hidden border-2 aspect-square ${
                  img.is_main
                    ? "border-blue-500"
                    : "border-zinc-200"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {img.is_main && (
                  <span className="absolute top-1 left-1 bg-blue-500 rounded-full p-0.5">
                    <Star className="h-3 w-3 text-white fill-white" />
                  </span>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!img.is_main && (
                    <button
                      type="button"
                      onClick={() => onSetExistingMain(img.id)}
                      className="rounded-full bg-white/90 p-1.5 hover:bg-white"
                      title="Set as main"
                    >
                      <Star className="h-3.5 w-3.5 text-yellow-500" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveExisting(img.id)}
                    className="rounded-full bg-white/90 p-1.5 hover:bg-white"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending (staged) images */}
      {pendingImages.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            New images (not saved yet)
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {pendingImages.map((img, idx) => (
              <div
                key={idx}
                className={`relative group rounded-lg overflow-hidden border-2 aspect-square ${
                  img.isMain ? "border-blue-500" : "border-dashed border-zinc-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {img.isMain && (
                  <span className="absolute top-1 left-1 bg-blue-500 rounded-full p-0.5">
                    <Star className="h-3 w-3 text-white fill-white" />
                  </span>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!img.isMain && !hasMain && (
                    <button
                      type="button"
                      onClick={() => onSetPendingMain(idx)}
                      className="rounded-full bg-white/90 p-1.5 hover:bg-white"
                      title="Set as main"
                    >
                      <Star className="h-3.5 w-3.5 text-yellow-500" />
                    </button>
                  )}
                  {!img.isMain && hasMain && !existingImages.some(i => i.is_main) && (
                    <button
                      type="button"
                      onClick={() => onSetPendingMain(idx)}
                      className="rounded-full bg-white/90 p-1.5 hover:bg-white"
                      title="Set as main"
                    >
                      <Star className="h-3.5 w-3.5 text-yellow-500" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemovePending(idx)}
                    className="rounded-full bg-white/90 p-1.5 hover:bg-white"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 py-6 text-sm text-zinc-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        {existingImages.length + pendingImages.length === 0 ? (
          <>
            <ImageIcon className="h-5 w-5" />
            <span>Click to upload product images</span>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            <span>Add more images</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {existingImages.length + pendingImages.length > 0 && !hasMain && (
        <p className="text-xs text-amber-600">
          ⚠ No main image set. The first image will be used by default.
        </p>
      )}
    </div>
  );
}

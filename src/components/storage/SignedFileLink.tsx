import { ReactNode, MouseEvent } from "react";
import { openSignedFile } from "@/lib/storage";

interface SignedFileLinkProps {
  bucket: string;
  urlOrPath: string | null | undefined;
  className?: string;
  children: ReactNode;
  expiresInSeconds?: number;
}

/**
 * Anchor-styled element that opens a file from a private storage bucket via a
 * freshly generated signed URL. Falls back to nothing if the URL cannot be resolved.
 */
export function SignedFileLink({
  bucket,
  urlOrPath,
  className,
  children,
  expiresInSeconds = 300,
}: SignedFileLinkProps) {
  const handleClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (!urlOrPath) return;
    await openSignedFile(bucket, urlOrPath, expiresInSeconds);
  };
  return (
    <a href="#" onClick={handleClick} className={className} rel="noopener noreferrer">
      {children}
    </a>
  );
}
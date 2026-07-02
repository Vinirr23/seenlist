import { type ImgHTMLAttributes } from "react";
import { cn } from "@seenlist/utils";

export interface PosterProps extends ImgHTMLAttributes<HTMLImageElement> {}

export function Poster({ className, alt = "", ...props }: PosterProps) {
  return <img className={cn(className)} alt={alt} {...props} />;
}

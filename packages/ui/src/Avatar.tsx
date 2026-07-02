import { type ImgHTMLAttributes } from "react";
import { cn } from "@seenlist/utils";

export interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement> {}

export function Avatar({ className, alt = "", ...props }: AvatarProps) {
  return <img className={cn(className)} alt={alt} {...props} />;
}

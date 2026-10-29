import { notFound } from "next/navigation";

// the design reference pages exist in `next dev` only
export default function DesignLayout({ children }: LayoutProps<"/design">) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}

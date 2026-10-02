import type { MDXComponents } from "mdx/types";

import { Pre } from "@/components/docs/content";

const components: MDXComponents = {
  pre: Pre,
  a: ({ href = "", children, ...props }) => {
    const external = /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        {...props}
      >
        {children}
        {external && <span className="sr-only"> (opens in a new tab)</span>}
      </a>
    );
  },
  table: (props) => (
    <div className="not-prose my-6 overflow-x-auto rounded-lg border border-rule bg-surface px-4 py-1 [&_td]:border-b [&_td]:border-rule [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top [&_td]:text-[15px] [&_th]:border-b [&_th]:border-rule [&_th]:py-2.5 [&_th]:pr-4 [&_th]:text-left [&_th]:text-[14px] [&_th]:font-semibold [&_tr:last-child_td]:border-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.86em]">
      <table className="w-full border-collapse" {...props} />
    </div>
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}

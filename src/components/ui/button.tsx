import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "cursor-pointer relative inline-flex items-center justify-center gap-1 whitespace-nowrap font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white hover:bg-blue-700 outline outline-1 -outline-offset-1 outline-blue-700 shadow-sm focus-visible:shadow-[0px_0px_0px_4px_rgba(59,130,246,0.1),0px_0px_0px_1px_rgba(59,130,246,0.4)]",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 outline outline-1 -outline-offset-1 outline-red-700 shadow-sm",
        outline:
          "border border-border bg-background dark:hover:bg-[hsl(228_10%_20%)] hover:bg-gray-100 text-foreground",
        secondary:
          "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
        ghost:
          "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100",
        link: "text-blue-600 underline-offset-4 hover:underline dark:text-blue-400",
      },
      size: {
        default: "h-10 px-4 text-sm leading-6 font-medium rounded-lg min-h-10",
        sm: "h-8 px-3 text-sm leading-4 font-medium rounded-md min-h-8",
        lg: "h-12 px-6 text-base leading-6 font-medium rounded-lg min-h-12",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'text';

type CommonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
};

type LinkButtonProps = CommonProps & {
  href: string;
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target'];
  rel?: AnchorHTMLAttributes<HTMLAnchorElement>['rel'];
};

type NativeButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button(props: LinkButtonProps | NativeButtonProps) {
  const { children, variant = 'primary', className = '' } = props;
  const classes = `button button-${variant} ${className}`.trim();

  if ('href' in props) {
    const { href, target, rel, ...rest } = props;
    return (
      <Link href={href} target={target} rel={rel} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { type = 'button', ...rest } = props;
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}

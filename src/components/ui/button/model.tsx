import type * as React from 'react'
import { type VariantProps } from 'class-variance-authority'
import { buttonVariants } from './constant'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

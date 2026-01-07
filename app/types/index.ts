import type { ReactNode } from "react"

export interface Section {
  id: string
  title: string
  subtitle?: ReactNode
  content?: ReactNode
  showButton?: boolean
  buttonText?: string
}

export interface SectionProps extends Section {
  isActive: boolean
}

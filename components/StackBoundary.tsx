'use client';

import { Component, type ReactNode } from 'react';

interface StackBoundaryProps {
  children: ReactNode;
}

interface StackBoundaryState {
  hasError: boolean;
}

export class StackBoundary extends Component<StackBoundaryProps, StackBoundaryState> {
  state: StackBoundaryState = { hasError: false };

  static getDerivedStateFromError(): StackBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

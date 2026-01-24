import React from 'react';
import { Card as PaperCard, CardProps } from 'react-native-paper';
import { StyleSheet } from 'react-native';

interface CustomCardProps extends CardProps {
  children: React.ReactNode;
}

export default function Card({ children, style, ...props }: CustomCardProps) {
  return (
    <PaperCard
      mode="elevated"
      style={[styles.card, style]}
      {...props}
    >
      {children}
    </PaperCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderRadius: 12,
  },
});

import React from 'react';
import { Button as PaperButton, ButtonProps } from 'react-native-paper';
import { StyleSheet } from 'react-native';

interface CustomButtonProps extends ButtonProps {
  fullWidth?: boolean;
}

export default function Button({
  mode = 'contained',
  fullWidth = false,
  style,
  ...props
}: CustomButtonProps) {
  return (
    <PaperButton
      mode={mode}
      style={[
        styles.button,
        fullWidth && styles.fullWidth,
        style,
      ]}
      contentStyle={styles.content}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
  },
  content: {
    height: 48,
  },
  fullWidth: {
    width: '100%',
  },
});

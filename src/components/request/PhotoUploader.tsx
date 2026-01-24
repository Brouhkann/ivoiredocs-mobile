import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Button, IconButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useImagePicker } from '../../hooks/useImagePicker';

interface PhotoUploaderProps {
  onImagesChange: (images: { uri: string; name: string; type: string }[]) => void;
}

export default function PhotoUploader({ onImagesChange }: PhotoUploaderProps) {
  const {
    images,
    loading,
    pickFromGallery,
    takePhoto,
    removeImage,
    hasImages,
    canAddMore,
  } = useImagePicker();

  // Notifier le parent quand les images changent
  React.useEffect(() => {
    onImagesChange(images);
  }, [images]);

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        Pièces justificatives (optionnel)
      </Text>
      <Text variant="bodySmall" style={styles.subtitle}>
        Ajoutez jusqu'à 5 photos de vos documents justificatifs
      </Text>

      {/* Prévisualisation des images */}
      {hasImages && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.preview}>
          {images.map((image, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri: image.uri }} style={styles.image} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Boutons d'action */}
      {canAddMore && (
        <View style={styles.actions}>
          <Button
            mode="outlined"
            icon="camera"
            onPress={takePhoto}
            loading={loading}
            disabled={loading}
            style={styles.actionButton}
          >
            Prendre une photo
          </Button>
          <Button
            mode="outlined"
            icon="image"
            onPress={pickFromGallery}
            loading={loading}
            disabled={loading}
            style={styles.actionButton}
          >
            Galerie
          </Button>
        </View>
      )}

      {!canAddMore && (
        <Text variant="bodySmall" style={styles.maxReached}>
          Maximum de 5 photos atteint
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    color: '#6b7280',
    marginBottom: 16,
  },
  preview: {
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  maxReached: {
    color: '#f59e0b',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

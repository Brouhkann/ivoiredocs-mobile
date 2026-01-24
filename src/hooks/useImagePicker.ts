import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { toast } from '../stores/toastStore';

export interface SelectedImage {
  uri: string;
  name: string;
  type: string;
}

export function useImagePicker() {
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [loading, setLoading] = useState(false);

  // Demander permission galerie
  const requestGalleryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Permission refusée pour accéder à la galerie');
      return false;
    }
    return true;
  };

  // Demander permission caméra
  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Permission refusée pour accéder à la caméra');
      return false;
    }
    return true;
  };

  // Sélectionner depuis la galerie
  const pickFromGallery = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - images.length, // Max 5 images au total
      });

      if (!result.canceled) {
        const newImages: SelectedImage[] = result.assets.map((asset, index) => ({
          uri: asset.uri,
          name: `photo_${Date.now()}_${index}.jpg`,
          type: 'image/jpeg',
        }));
        setImages([...images, ...newImages]);
        toast.success(`${newImages.length} photo(s) ajoutée(s)`);
      }
    } catch (error) {
      console.error('Erreur sélection galerie:', error);
      toast.error('Erreur lors de la sélection des photos');
    } finally {
      setLoading(false);
    }
  };

  // Prendre une photo
  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    if (images.length >= 5) {
      toast.warning('Maximum 5 photos');
      return;
    }

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled) {
        const newImage: SelectedImage = {
          uri: result.assets[0].uri,
          name: `photo_${Date.now()}.jpg`,
          type: 'image/jpeg',
        };
        setImages([...images, newImage]);
        toast.success('Photo ajoutée');
      }
    } catch (error) {
      console.error('Erreur capture photo:', error);
      toast.error('Erreur lors de la capture de la photo');
    } finally {
      setLoading(false);
    }
  };

  // Supprimer une image
  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    toast.info('Photo supprimée');
  };

  // Réinitialiser
  const clearImages = () => {
    setImages([]);
  };

  return {
    images,
    loading,
    pickFromGallery,
    takePhoto,
    removeImage,
    clearImages,
    hasImages: images.length > 0,
    canAddMore: images.length < 5,
  };
}

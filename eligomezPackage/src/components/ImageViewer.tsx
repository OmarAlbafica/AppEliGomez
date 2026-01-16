import React, { useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import ImageZoom from 'react-native-image-zoom-viewer';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  title?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  visible,
  images,
  initialIndex = 0,
  onClose,
  title,
}) => {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Resetear índice cuando las imágenes cambian
  React.useEffect(() => {
    setCurrentIndex(0);
  }, [images]);

  if (!visible || images.length === 0) return null;

  // Convertir URLs a formato que espera ImageZoom
  // Usar dimensiones que hagan que la imagen quepa perfectamente en la pantalla
  const imageData = images.map((url) => ({
    url: url,
    width: SCREEN_WIDTH - 40, // Dejar margen
    height: SCREEN_HEIGHT * 0.65, // Altura disponible
    props: {
      resizeMode: 'contain', // Importante: asegura que quepa completa sin crop
    },
  }));

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {title || 'Imágenes'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeButtonText, { color: theme.colors.text }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Image Zoom Viewer */}
        <ImageZoom
          imageUrls={imageData}
          index={currentIndex}
          enableImageZoom={true}
          onCancel={onClose}
          onChange={() => {}} // Desactivar cambio de imagen por swipe
          enableSwipeDown={false}
          doubleClickInterval={300}
          pageAnimateTime={100}
          useNativeDriver={true}
          enablePreload={true}
          backgroundColor="transparent"
          flipThreshold={0}
          maxOverflow={0}
          renderHeader={(currentIndex) => (
            <View style={styles.headerOverlay}>
              <Text style={styles.headerOverlayText}>
                {currentIndex !== undefined ? `${currentIndex + 1} / ${images.length}` : ''}
              </Text>
            </View>
          )}
          renderFooter={() => <View />}
          renderIndicator={() => <View />}
          failImageSource={{
            url: 'https://via.placeholder.com/400x300?text=No+Image',
            width: SCREEN_WIDTH - 40,
            height: SCREEN_HEIGHT * 0.65,
          }}
        />

        {/* Controles de navegación */}
        {images.length > 1 && (
          <View style={styles.controls}>
            <TouchableOpacity
              onPress={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              style={[
                styles.controlButton,
                { backgroundColor: theme.colors.primary },
                currentIndex === 0 && styles.controlButtonDisabled,
              ]}
            >
              <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>
                ◀ Anterior
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCurrentIndex(Math.min(images.length - 1, currentIndex + 1))}
              disabled={currentIndex === images.length - 1}
              style={[
                styles.controlButton,
                { backgroundColor: theme.colors.primary },
                currentIndex === images.length - 1 && styles.controlButtonDisabled,
              ]}
            >
              <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>
                Siguiente ▶
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Thumbnails Gallery */}
        {images.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbnailContainer}
            contentContainerStyle={styles.thumbnailContent}
          >
            {images.map((img, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setCurrentIndex(index)}
                style={[
                  styles.thumbnail,
                  { borderColor: theme.colors.primary },
                  index === currentIndex && styles.thumbnailActive,
                ]}
              >
                <Image
                  source={{ uri: img }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    zIndex: 1000,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
  },
  headerOverlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  controlButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  controlButtonDisabled: {
    opacity: 0.3,
  },
  controlButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  thumbnailContainer: {
    maxHeight: 85,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  thumbnailContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  thumbnail: {
    width: 65,
    height: 65,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailActive: {
    borderWidth: 3,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});

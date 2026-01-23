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
  const imageZoomIndexRef = React.useRef(0);
  const [displayIndex, setDisplayIndex] = useState(0);

  // Resetear índice cuando las imágenes cambian
  React.useEffect(() => {
    if (visible) {
      imageZoomIndexRef.current = 0;
      setDisplayIndex(0);
    }
  }, [images, visible]);

  const handleThumbnailPress = React.useCallback((index: number) => {
    imageZoomIndexRef.current = index;
    setDisplayIndex(index);
  }, []);

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
    <Modal visible={visible} transparent={true} animationType="fade" key={`modal-${images.join('-')}`}>
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
          key={`zoom-${displayIndex}`}
          imageUrls={imageData}
          index={displayIndex}
          enableImageZoom={true}
          onCancel={onClose}
          onChange={(index) => {
            // Solo actualizar si el índice cambió (por swipe del usuario)
            // No actualizar si fue por click en thumbnail (que ya actualizó displayIndex)
            if (typeof index === 'number' && index >= 0 && index < images.length) {
              // Usar setTimeout para evitar actualizar durante render
              setTimeout(() => {
                imageZoomIndexRef.current = index;
                setDisplayIndex(index);
              }, 0);
            }
          }}
          enableSwipeDown={false}
          doubleClickInterval={300}
          pageAnimateTime={260}
          useNativeDriver={true}
          enablePreload={true}
          backgroundColor="transparent"
          flipThreshold={50}
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
                onPress={() => handleThumbnailPress(index)}
                style={[
                  styles.thumbnail,
                  { borderColor: theme.colors.primary },
                  index === displayIndex && styles.thumbnailActive,
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
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 1000,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
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

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, ScrollView, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent, Image } from 'react-native';
import { TruckIcon, UsersIcon } from './icons';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onComplete?: () => void;
}

interface OnboardingSlide {
  icon: React.ComponentType<{ size: number; color: string }>;
  title: string;
  description: string;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    icon: () => (
      <Image 
        source={require('../assets/logo.png')} 
        style={{ width: 80, height: 80 }}
        resizeMode="contain"
      />
    ),
    title: 'Gestiona tus Pedidos',
    description: 'Crea, edita y consulta todos tus pedidos de forma rápida y sencilla. Mantén el control total de tu inventario.',
    color: '#4F46E5',
  },
  {
    icon: TruckIcon,
    title: 'Seguimiento en Tiempo Real',
    description: 'Monitorea el estado de tus entregas y mantente informado en cada etapa del proceso de distribución.',
    color: '#10B981',
  },
  {
    icon: UsersIcon,
    title: 'Gestión de Clientes',
    description: 'Administra tu base de clientes, historial de pedidos y encomendistas en un solo lugar.',
    color: '#F59E0B',
  },
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const { theme } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    
    if (index !== currentIndex) {
      setCurrentIndex(index);
      
      // Mostrar botón solo en la última slide
      if (index === slides.length - 1) {
        Animated.spring(buttonOpacity, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }).start();
      } else {
        Animated.spring(buttonOpacity, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }).start();
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {slides.map((slide, index) => (
          <View key={index} style={[styles.slide, { width }]}>
            <View style={[styles.iconCircle, { backgroundColor: slide.color }]}>
              <slide.icon size={80} color="#fff" />
            </View>
            
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {slide.title}
            </Text>
            
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Indicadores de página */}
      <View style={styles.footer}>
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: index === currentIndex ? 1 : 0.3,
                  width: index === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Botón Continuar - solo visible en la última slide */}
      <Animated.View style={[styles.buttonContainer, { opacity: buttonOpacity }]}>
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: theme.colors.primary }]}
          onPress={onComplete}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continuar</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: -0.3,
    paddingHorizontal: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
  },
  continueButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

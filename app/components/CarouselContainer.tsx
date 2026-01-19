'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Splide from '@splidejs/splide'
import '@splidejs/splide/css'
import type { PartnerCardViewProps } from '@/app/types'
import PartnerCard from './PartnerCard'

interface CarouselContainerProps {
  cards: PartnerCardViewProps[]
  selectedPartner: PartnerCardViewProps | null
  onPartnerSelect: (partner: PartnerCardViewProps) => void
  onEmailClose: () => void
  isGeneratingEmail: boolean
}

export default function CarouselContainer({
  cards,
  selectedPartner,
  onPartnerSelect,
  onEmailClose,
  isGeneratingEmail,
}: CarouselContainerProps) {
  const splideRef = useRef<Splide | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize Splide carousel
    splideRef.current = new Splide(containerRef.current, {
      type: 'slide',
      perPage: 3,
      perMove: 1,
      gap: 'clamp(10px, 2.5vw, 14px)',
      autoScroll: {
        speed: 2,
        pauseOnHover: true,
        rewind: true,
      },
      arrows: true,
      pagination: true,
      breakpoints: {
        640: { perPage: 1 },
        1024: { perPage: 2 },
        1280: { perPage: 3 },
      },
      drag: true,
      keyboard: true,
      wheel: true,
      autoplay: false,
    })

    splideRef.current.mount()

    return () => {
      if (splideRef.current) {
        splideRef.current.destroy()
      }
    }
  }, [])

  // Add custom CSS for Splide styling
  const customStyles = `
    .splide {
      --splide-track-padding: 0px;
      --splide-gap: clamp(10px, 2.5vw, 14px);
    }
    
    .splide__track {
      padding: 0;
      border-radius: 8px;
    }
    
    .splide__slide {
      padding: 0;
      min-height: 290px;
    }
    
    .splide__arrow {
      background-color: rgba(0, 0, 0, 0.6);
      border-radius: 4px;
      width: 40px;
      height: 40px;
      transition: background-color 0.3s ease;
    }
    
    .splide__arrow:hover {
      background-color: rgba(0, 0, 0, 0.8);
    }
    
    .splide__pagination__page {
      background-color: rgba(0, 0, 0, 0.4);
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin: 0 4px;
      transition: background-color 0.3s ease;
    }
    
    .splide__pagination__page.is-active {
      background-color: rgba(0, 0, 0, 0.8);
    }
  `

  return (
    <div className="w-full">
      <style>{customStyles}</style>
      
      <h2
        className="font-bold text-gray-900 mb-4"
        style={{ fontSize: 'clamp(16px, 4vw, 22px)' }}
      >
        Domain Infrastructure & Partners ({cards.length})
      </h2>

      <div ref={containerRef} className="splide">
        <div className="splide__track">
          <ul className="splide__list">
            <AnimatePresence>
              {cards.map((card) => (
                <li key={card.id} className="splide__slide">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    <PartnerCard
                      partner={card}
                      onSelect={onPartnerSelect}
                      isSelected={selectedPartner?.id === card.id}
                      isLoading={
                        isGeneratingEmail &&
                        selectedPartner?.id === card.id
                      }
                    />
                  </motion.div>
                </li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
        <div className="splide__arrows"></div>
        <div className="splide__pagination"></div>
      </div>
    </div>
  )
}

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "../../lib/utils";

const CONSTANTS = {
  itemSize: 48,
  containerSize: 250,
  openStagger: 0.02,
  closeStagger: 0.07,
};

const STYLES = {
  trigger: {
    container:
      "rounded-full flex items-center bg-foreground justify-center cursor-pointer outline-none ring-0 hover:brightness-125 transition-all duration-100 z-50 shadow-lg",
    active: "bg-foreground",
  },
  item: {
    container:
      "rounded-full flex items-center justify-center absolute bg-muted hover:bg-muted/50 cursor-pointer shadow-md",
    label: "text-xs text-foreground absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap bg-card px-1.5 py-0.5 rounded shadow-sm",
  },
};

const pointOnCircle = (i, n, r, cx = 0, cy = 0) => {
  const theta = (2 * Math.PI * i) / n - Math.PI / 2;
  const x = cx + r * Math.cos(theta);
  const y = cy + r * Math.sin(theta) + 0;
  return { x, y };
};

function MenuItem({ icon, label, href, index, totalItems, isOpen, onNavigate }) {
  const { x, y } = pointOnCircle(index, totalItems, CONSTANTS.containerSize / 2);
  const [hovering, setHovering] = useState(false);
  const navigate = useNavigate();

  function handleClick(e) {
    e.preventDefault();
    onNavigate?.();
    navigate(href);
  }

  return (
    <a href={href} onClick={handleClick} className={STYLES.item.container}>
      <motion.button
        animate={{
          x: isOpen ? x : 0,
          y: isOpen ? y : 0,
        }}
        whileHover={{
          scale: 1.1,
          transition: { duration: 0.1, delay: 0 },
        }}
        whileTap={{ scale: 0.92 }}
        transition={{
          delay: isOpen ? index * CONSTANTS.openStagger : index * CONSTANTS.closeStagger,
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        style={{
          height: CONSTANTS.itemSize - 2,
          width: CONSTANTS.itemSize - 2,
        }}
        className={STYLES.item.container}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {icon}
        {hovering && isOpen && <p className={STYLES.item.label}>{label}</p>}
      </motion.button>
    </a>
  );
}

function MenuTrigger({ setIsOpen, isOpen, itemsLength, closeAnimationCallback, openIcon, closeIcon }) {
  const animate = useAnimationControls();
  const shakeAnimation = useAnimationControls();

  const scaleTransition = Array.from({ length: itemsLength - 1 })
    .map((_, index) => index + 1)
    .reduce((acc, _, index) => {
      const increasedValue = index * 0.15;
      acc.push(1 + increasedValue);
      return acc;
    }, []);

  const closeAnimation = async () => {
    shakeAnimation.start({
      translateX: [0, 2, -2, 0, 2, -2, 0],
      transition: {
        duration: CONSTANTS.closeStagger,
        ease: "linear",
        repeat: Infinity,
        repeatType: "loop",
      },
    });
    for (let i = 0; i < scaleTransition.length; i++) {
      await animate.start({
        height: Math.min(CONSTANTS.itemSize * scaleTransition[i], CONSTANTS.itemSize + CONSTANTS.itemSize / 2),
        width: Math.min(CONSTANTS.itemSize * scaleTransition[i], CONSTANTS.itemSize + CONSTANTS.itemSize / 2),
        backgroundColor: `color-mix(in srgb, hsl(var(--foreground)) ${Math.max(100 - i * 10, 40)}%, hsl(var(--background)))`,
        transition: { duration: CONSTANTS.closeStagger / 2, ease: "linear" },
      });
      if (i !== scaleTransition.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, CONSTANTS.closeStagger * 1000));
      }
    }

    shakeAnimation.stop();
    shakeAnimation.start({ translateX: 0, transition: { duration: 0 } });

    animate.start({
      height: CONSTANTS.itemSize,
      width: CONSTANTS.itemSize,
      backgroundColor: "hsl(var(--foreground))",
      transition: { duration: 0.1, ease: "backInOut" },
    });
  };

  return (
    <motion.div animate={shakeAnimation} className="pointer-events-auto z-50">
      <motion.button
        animate={animate}
        style={{ height: CONSTANTS.itemSize, width: CONSTANTS.itemSize }}
        className={cn(STYLES.trigger.container, isOpen && STYLES.trigger.active)}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            closeAnimationCallback();
            closeAnimation();
          } else {
            setIsOpen(true);
          }
        }}
      >
        <AnimatePresence mode="popLayout">
          {isOpen ? (
            <motion.span
              key="menu-close"
              initial={{ opacity: 0, filter: "blur(10px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(10px)" }}
              transition={{ duration: 0.2 }}
            >
              {closeIcon}
            </motion.span>
          ) : (
            <motion.span
              key="menu-open"
              initial={{ opacity: 0, filter: "blur(10px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(10px)" }}
              transition={{ duration: 0.2 }}
            >
              {openIcon}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
}

export function CircleMenu({
  items,
  openIcon = <Menu size={18} className="text-background" />,
  closeIcon = <X size={18} className="text-background" />,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const animate = useAnimationControls();

  const closeAnimationCallback = async () => {
    await animate.start({
      rotate: -360,
      filter: "blur(1px)",
      transition: { duration: CONSTANTS.closeStagger * (items.length + 2), ease: "linear" },
    });
    await animate.start({ rotate: 0, filter: "blur(0px)", transition: { duration: 0 } });
  };

  return (
    <div
      style={{
        width: CONSTANTS.containerSize,
        height: CONSTANTS.containerSize,
        // Closed: shrink the hit area to nothing so this floating box never blocks
        // taps on the page content underneath it. The trigger button re-enables
        // pointer events on itself explicitly (see MenuTrigger).
        pointerEvents: isOpen ? "auto" : "none",
      }}
      className="relative flex items-center justify-center place-self-center"
    >
      <MenuTrigger
        setIsOpen={setIsOpen}
        isOpen={isOpen}
        itemsLength={items.length}
        closeAnimationCallback={closeAnimationCallback}
        openIcon={openIcon}
        closeIcon={closeIcon}
      />
      <motion.div animate={animate} className="absolute inset-0 z-0 flex items-center justify-center">
        {items.map((item, index) => (
          <MenuItem
            key={`menu-item-${index}`}
            icon={item.icon}
            label={item.label}
            href={item.href}
            index={index}
            totalItems={items.length}
            isOpen={isOpen}
            onNavigate={() => setIsOpen(false)}
          />
        ))}
      </motion.div>
    </div>
  );
}

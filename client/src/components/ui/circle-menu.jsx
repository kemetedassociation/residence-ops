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

// Sans `arc`, les éléments se répartissent sur un cercle complet (comportement d'origine,
// pensé pour un déclencheur au centre de l'écran). Avec `arc` ({startDeg, endDeg}, en degrés,
// 0 = droite, 90 = bas), ils se répartissent uniquement sur cette portion — utile quand le
// déclencheur est ancré dans un coin, pour que rien ne parte hors de l'écran.
const pointOnCircle = (i, n, r, arc) => {
  let theta;
  if (arc) {
    const deg = n > 1 ? arc.startDeg + ((arc.endDeg - arc.startDeg) * i) / (n - 1) : (arc.startDeg + arc.endDeg) / 2;
    theta = (deg * Math.PI) / 180;
  } else {
    theta = (2 * Math.PI * i) / n - Math.PI / 2;
  }
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
};

function MenuItem({ icon, label, href, index, totalItems, isOpen, onNavigate, arc, radius }) {
  const { x, y } = pointOnCircle(index, totalItems, radius, arc);
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
      >
        {icon}
        {/* Toujours visible (pas seulement au survol) : au doigt, sur mobile, il n'y a pas de survol. */}
        {isOpen && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * CONSTANTS.openStagger + 0.15 }}
            className={STYLES.item.label}
          >
            {label}
          </motion.p>
        )}
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
  // `arc` restreint la propagation à une portion de cercle (voir pointOnCircle) — utile
  // quand le déclencheur est ancré dans un coin plutôt qu'au centre de l'écran.
  arc,
  radius = CONSTANTS.containerSize / 2,
  // "center" (par défaut, comportement d'origine) ou "start" pour ancrer le point d'origine
  // en haut à gauche de la zone au lieu de son centre.
  align = "center",
  // État contrôlable depuis le parent (ex. pour afficher un fond assombri pendant l'ouverture).
  isOpen: controlledOpen,
  onOpenChange,
  className,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = (value) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };
  const animate = useAnimationControls();

  const closeAnimationCallback = async () => {
    await animate.start({
      rotate: -360,
      filter: "blur(1px)",
      transition: { duration: CONSTANTS.closeStagger * (items.length + 2), ease: "linear" },
    });
    await animate.start({ rotate: 0, filter: "blur(0px)", transition: { duration: 0 } });
  };

  const alignClasses = align === "start" ? "items-start justify-start" : "items-center justify-center place-self-center";

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
      className={cn("relative flex", alignClasses, className)}
    >
      <MenuTrigger
        setIsOpen={setIsOpen}
        isOpen={isOpen}
        itemsLength={items.length}
        closeAnimationCallback={closeAnimationCallback}
        openIcon={openIcon}
        closeIcon={closeIcon}
      />
      <motion.div
        animate={animate}
        className={cn("absolute inset-0 z-0 flex", align === "start" ? "items-start justify-start" : "items-center justify-center")}
      >
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
            arc={arc}
            radius={radius}
          />
        ))}
      </motion.div>
    </div>
  );
}

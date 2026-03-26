import { useEffect, useState } from "react";
import { type Relationship } from "./relationship-editor";

interface Person {
  id: string;
  name: string;
  [key: string]: any;
}

interface RelationshipLinesProps {
  relationships: Relationship[];
  people: Person[];
  onRelationshipClick?: (relationship: Relationship) => void;
}

const relationshipStyles = {
  reports_to: { color: "#9333ea", width: 2, dash: "0" },
  influences: { color: "#2563eb", width: 2, dash: "0" },
  collaborates: { color: "#059669", width: 2, dash: "5,5" },
  mentor: { color: "#e11d48", width: 2, dash: "0" },
  custom: { color: "#64748b", width: 1, dash: "3,3" },
};

const strengthOpacity = {
  strong: 1,
  medium: 0.6,
  weak: 0.3,
};

export function RelationshipLines({
  relationships,
  people,
  onRelationshipClick,
}: RelationshipLinesProps) {
  const [lines, setLines] = useState<Array<{ id: string; path: string; rel: Relationship }>>([]);
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const updateLines = () => {
      // Find the closest .org-chart-canvas container
      const containers = document.querySelectorAll('.org-chart-canvas');
      
      // Try to find the visible container (the one that's not in a hidden dialog)
      let activeContainer: HTMLElement | null = null;
      containers.forEach((container) => {
        const dialog = container.closest('[role="dialog"]');
        if (dialog) {
          // Check if dialog is visible
          const dialogEl = dialog as HTMLElement;
          if (dialogEl.offsetParent !== null) {
            activeContainer = container as HTMLElement;
          }
        } else {
          // Not in a dialog, use this one if we haven't found one yet
          if (!activeContainer) {
            activeContainer = container as HTMLElement;
          }
        }
      });

      // If we have an active modal, use that; otherwise use the first one
      const container = activeContainer || containers[0] as HTMLElement;
      
      if (!container) return;
      
      setContainerElement(container);

      const newLines = relationships.map((rel) => {
        const path = getConnectionPath(rel.fromPersonId, rel.toPersonId, container);
        return { id: rel.id, path: path || "", rel };
      }).filter(line => line.path);
      
      setLines(newLines);
    };

    // Initial update
    updateLines();

    // Update on scroll or resize
    const handleUpdate = () => {
      // Small delay to ensure DOM is updated
      setTimeout(updateLines, 0);
    };

    // Listen to all potential containers
    const containers = document.querySelectorAll('.org-chart-canvas');
    containers.forEach(container => {
      container.addEventListener('scroll', handleUpdate);
    });
    
    window.addEventListener('resize', handleUpdate);
    
    // Use MutationObserver to detect DOM changes
    const observer = new MutationObserver(handleUpdate);
    containers.forEach(container => {
      observer.observe(container, { childList: true, subtree: true, attributes: true });
    });

    // Also observe the document for new containers
    const docObserver = new MutationObserver(handleUpdate);
    docObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      containers.forEach(container => {
        container.removeEventListener('scroll', handleUpdate);
      });
      window.removeEventListener('resize', handleUpdate);
      observer.disconnect();
      docObserver.disconnect();
    };
  }, [relationships, people]);

  const getPersonElement = (personId: string): HTMLElement | null => {
    const personNode = document.querySelector(`[data-person-id="${personId}"]`);
    if (!personNode) return null;
    
    // Get the actual card element (the bordered div inside)
    const cardInner = personNode.querySelector('.person-card-inner') as HTMLElement;
    return cardInner || personNode as HTMLElement;
  };

  const getConnectionPath = (fromId: string, toId: string, container: HTMLElement): string | null => {
    const fromEl = getPersonElement(fromId);
    const toEl = getPersonElement(toId);

    if (!fromEl || !toEl) return null;

    const containerRect = container.getBoundingClientRect();
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    // Get scroll offset
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    // Calculate all positions relative to the container's scroll position
    // Convert viewport coordinates to container coordinates
    const fromLeft = fromRect.left - containerRect.left + scrollLeft;
    const fromTop = fromRect.top - containerRect.top + scrollTop;
    const fromRight = fromLeft + fromRect.width;
    const fromBottom = fromTop + fromRect.height;
    const fromCenterX = fromLeft + fromRect.width / 2;
    const fromCenterY = fromTop + fromRect.height / 2;

    const toLeft = toRect.left - containerRect.left + scrollLeft;
    const toTop = toRect.top - containerRect.top + scrollTop;
    const toRight = toLeft + toRect.width;
    const toBottom = toTop + toRect.height;
    const toCenterX = toLeft + toRect.width / 2;
    const toCenterY = toTop + toRect.height / 2;

    // Calculate edge points based on direction
    let fromX, fromY, toX, toY;

    const verticalDistance = Math.abs(toCenterY - fromCenterY);
    const horizontalDistance = Math.abs(toCenterX - fromCenterX);

    if (verticalDistance > horizontalDistance) {
      // Vertical connection (top-bottom)
      fromX = fromCenterX;
      toX = toCenterX;
      
      if (fromCenterY < toCenterY) {
        // From is above To - connect from bottom to top
        fromY = fromBottom;
        toY = toTop;
      } else {
        // From is below To - connect from top to bottom
        fromY = fromTop;
        toY = toBottom;
      }
    } else {
      // Horizontal connection (left-right)
      fromY = fromCenterY;
      toY = toCenterY;
      
      if (fromCenterX < toCenterX) {
        // From is left of To - connect from right to left
        fromX = fromRight;
        toX = toLeft;
      } else {
        // From is right of To - connect from left to right
        fromX = fromLeft;
        toX = toRight;
      }
    }

    // Create curved path with control points
    if (verticalDistance > horizontalDistance) {
      // Vertical curve
      const controlOffset = Math.min(Math.abs(toY - fromY) * 0.3, 60);
      return `M ${fromX} ${fromY} C ${fromX} ${fromY + (toY > fromY ? controlOffset : -controlOffset)}, ${toX} ${toY - (toY > fromY ? controlOffset : -controlOffset)}, ${toX} ${toY}`;
    } else {
      // Horizontal curve
      const controlOffset = Math.min(Math.abs(toX - fromX) * 0.3, 60);
      return `M ${fromX} ${fromY} C ${fromX + (toX > fromX ? controlOffset : -controlOffset)} ${fromY}, ${toX - (toX > fromX ? controlOffset : -controlOffset)} ${toY}, ${toX} ${toY}`;
    }
  };

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3, 0 6" fill="currentColor" />
        </marker>
      </defs>
      {lines.map(({ id, path, rel }) => {
        if (!path) return null;

        const style = relationshipStyles[rel.type] || relationshipStyles.custom;
        const opacity = strengthOpacity[rel.strength];

        return (
          <g key={id} className="relationship-line">
            <path
              d={path}
              stroke={style.color}
              strokeWidth={style.width}
              strokeDasharray={style.dash}
              fill="none"
              opacity={opacity}
              markerEnd={rel.direction === "one-way" ? "url(#arrowhead)" : undefined}
              style={{ color: style.color }}
            />
            {/* Invisible wider path for easier clicking */}
            <path
              d={path}
              stroke="transparent"
              strokeWidth={20}
              fill="none"
              className="pointer-events-auto cursor-pointer hover:stroke-slate-300"
              onClick={() => onRelationshipClick?.(rel)}
            />
          </g>
        );
      })}
    </svg>
  );
}
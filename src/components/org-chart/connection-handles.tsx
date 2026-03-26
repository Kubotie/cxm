import { useState } from "react";
import { ArrowRight } from "lucide-react";

interface ConnectionHandlesProps {
  personId: string;
  onConnectionStart: (fromId: string) => void;
  onConnectionEnd: (toId: string) => void;
  isDragging: boolean;
}

export function ConnectionHandles({ personId, onConnectionStart, onConnectionEnd, isDragging }: ConnectionHandlesProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  const handleDragStart = (e: React.DragEvent, position: 'top' | 'right' | 'bottom' | 'left') => {
    e.stopPropagation();
    setIsDraggingHandle(true);
    onConnectionStart(personId);
    
    // Set drag data
    e.dataTransfer.setData('connection-from', personId);
    e.dataTransfer.effectAllowed = 'link';
    
    // Create a small drag image
    const dragImage = document.createElement('div');
    dragImage.style.width = '20px';
    dragImage.style.height = '20px';
    dragImage.style.backgroundColor = '#3b82f6';
    dragImage.style.borderRadius = '50%';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 10, 10);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = () => {
    setIsDraggingHandle(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const fromId = e.dataTransfer.getData('connection-from');
    if (fromId && fromId !== personId) {
      onConnectionEnd(personId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'link';
  };

  const renderHandle = (position: 'top' | 'right' | 'bottom' | 'left') => {
    const baseClass = "absolute w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing hover:bg-blue-600 hover:scale-110 transition-all duration-200 z-[100]";
    const positionClass = {
      top: "left-1/2 -translate-x-1/2 -top-4",
      right: "top-1/2 -translate-y-1/2 -right-4",
      bottom: "left-1/2 -translate-x-1/2 -bottom-4",
      left: "top-1/2 -translate-y-1/2 -left-4",
    }[position];

    const rotationClass = {
      top: "rotate-[-90deg]",
      right: "rotate-0",
      bottom: "rotate-90",
      left: "rotate-180",
    }[position];

    return (
      <div
        key={position}
        className={`${baseClass} ${positionClass}`}
        draggable
        onDragStart={(e) => handleDragStart(e, position)}
        onDragEnd={handleDragEnd}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setIsHovered(true)}
      >
        <ArrowRight className={`w-4 h-4 ${rotationClass}`} />
      </div>
    );
  };

  // Show handles when hovered, dragging a handle, or when another node is being dragged
  const shouldShowHandles = isHovered || isDraggingHandle || isDragging;

  return (
    <>
      {/* Hover trigger area - extends beyond the card */}
      <div
        className="absolute -inset-6 pointer-events-auto"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => !isDraggingHandle && setIsHovered(false)}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{ zIndex: 20 }}
      >
        {/* Drop zone overlay for dragging state */}
        {isDragging && (
          <div className="absolute inset-6 border-2 border-dashed border-blue-400 rounded-lg bg-blue-50 bg-opacity-30 pointer-events-none" />
        )}
      </div>

      {/* Handles - only show when conditions are met */}
      {shouldShowHandles && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 100 }}>
          <div className="pointer-events-auto">
            {renderHandle('top')}
            {renderHandle('right')}
            {renderHandle('bottom')}
            {renderHandle('left')}
          </div>
        </div>
      )}
    </>
  );
}
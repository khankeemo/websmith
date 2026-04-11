"use client";

import React, { useState } from "react";

interface KanbanCard {
  _id: string;
  title: string;
  subtitle?: string;
  status: string;
  priority?: string;
  [key: string]: any;
}

interface KanbanColumn {
  id: string;
  title: string;
  status: string;
  color: string;
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  onCardDrop: (cardId: string, fromStatus: string, toStatus: string) => Promise<void>;
  renderCard?: (card: KanbanCard) => React.ReactNode;
}

export default function KanbanBoard({ columns, cards, onCardDrop, renderCard }: KanbanBoardProps) {
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, card: KanbanCard) => {
    setDraggedCard(card);
    e.dataTransfer.setData("cardId", card._id);
    e.dataTransfer.setData("fromStatus", card.status);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, toStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    const cardId = e.dataTransfer.getData("cardId");
    const fromStatus = e.dataTransfer.getData("fromStatus");

    if (cardId && fromStatus && fromStatus !== toStatus) {
      try {
        await onCardDrop(cardId, fromStatus, toStatus);
      } catch (error) {
        console.error("Failed to drop card:", error);
      }
    }

    setDraggedCard(null);
  };

  const getPriorityColor = (priority?: string) => {
    if (!priority) return "#8E8E93";
    const colors: Record<string, string> = {
      low: "#34C759",
      medium: "#FF9500",
      high: "#FF3B30",
    };
    return colors[priority.toLowerCase()] || "#8E8E93";
  };

  return (
    <div style={styles.board} className="wsd-kanban-board">
      {columns.map((column) => {
        const columnCards = cards.filter((card) => card.status === column.status);
        const isDragOver = dragOverColumn === column.id;

        return (
          <div
            key={column.id}
            className="wsd-kanban-column"
            style={{
              ...styles.column,
              border: isDragOver ? `2px dashed ${column.color}` : "2px solid transparent",
              backgroundColor: isDragOver ? `${column.color}08` : "#F9F9FB",
            }}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.status)}
          >
            <div style={styles.columnHeader}>
              <h3 style={{ ...styles.columnTitle, color: column.color }}>{column.title}</h3>
              <span style={{ ...styles.cardCount, backgroundColor: `${column.color}20`, color: column.color }}>
                {columnCards.length}
              </span>
            </div>

            <div style={styles.cardList}>
              {columnCards.map((card) => (
                <div
                  key={card._id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, card)}
                  style={{
                    ...styles.card,
                    opacity: draggedCard?._id === card._id ? 0.5 : 1,
                    cursor: "grab",
                  }}
                  onDragEnd={() => setDraggedCard(null)}
                >
                  {renderCard ? (
                    renderCard(card)
                  ) : (
                    <>
                      <div style={styles.cardHeader}>
                        <strong style={styles.cardTitle}>{card.title}</strong>
                        {card.priority && (
                          <span
                            style={{
                              ...styles.priorityBadge,
                              backgroundColor: `${getPriorityColor(card.priority)}20`,
                              color: getPriorityColor(card.priority),
                            }}
                          >
                            {card.priority}
                          </span>
                        )}
                      </div>
                      {card.subtitle && <p style={styles.cardSubtitle}>{card.subtitle}</p>}
                    </>
                  )}
                </div>
              ))}

              {columnCards.length === 0 && (
                <div style={styles.emptyColumn}>
                  <p style={styles.emptyText}>Drop items here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <style>{`
        @media (max-width: 768px) {
          .wsd-kanban-board {
            display: flex !important;
            overflow-x: auto;
            scroll-snap-type: x proximity;
            padding-bottom: 8px;
          }
          .wsd-kanban-column {
            min-width: min(86vw, 320px);
            scroll-snap-align: start;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    minHeight: "500px",
  },
  column: {
    backgroundColor: "#F2F2F7",
    borderRadius: "16px",
    padding: "16px",
    transition: "all 0.2s ease",
  },
  columnHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: "2px solid #E5E5EA",
  },
  columnTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
  },
  cardCount: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "13px",
    fontWeight: 600,
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minHeight: "100px",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    padding: "14px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
    border: "1px solid #E5E5EA",
    transition: "all 0.2s ease",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
    marginBottom: "6px",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1C1C1E",
    flex: 1,
  },
  priorityBadge: {
    padding: "3px 8px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "capitalize",
  },
  cardSubtitle: {
    margin: 0,
    fontSize: "13px",
    color: "#8E8E93",
    lineHeight: 1.4,
  },
  emptyColumn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100px",
    border: "2px dashed #D1D5DB",
    borderRadius: "12px",
  },
  emptyText: {
    margin: 0,
    fontSize: "13px",
    color: "#8E8E93",
  },
};

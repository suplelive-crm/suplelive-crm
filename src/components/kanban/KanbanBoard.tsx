import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { KanbanColumn } from './KanbanColumn';
import { useKanbanStore } from '@/store/kanbanStore';

export function KanbanBoard() {
  const {
    currentBoard,
    stages,
    assignments,
    moveClientToStage,
    reorderClientsInStage,
    reorderStages,
  } = useKanbanStore();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !currentBoard) {
    return null;
  }

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, type } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === 'stage') {
      // Reorder stages
      const newStageOrder = Array.from(stages);
      const [reorderedStage] = newStageOrder.splice(source.index, 1);
      newStageOrder.splice(destination.index, 0, reorderedStage);

      const stageIds = newStageOrder.map(stage => stage.id);
      await reorderStages(currentBoard.id, stageIds);
      return;
    }

    if (type === 'client') {
      const sourceStageId = source.droppableId;
      const destStageId = destination.droppableId;

      if (sourceStageId === destStageId) {
        // Reorder within same stage
        const stageAssignments = assignments
          .filter(a => a.stage_id === sourceStageId)
          .sort((a, b) => a.position - b.position);

        const newOrder = Array.from(stageAssignments);
        const [reorderedAssignment] = newOrder.splice(source.index, 1);
        newOrder.splice(destination.index, 0, reorderedAssignment);

        const assignmentIds = newOrder.map(assignment => assignment.id);
        await reorderClientsInStage(sourceStageId, assignmentIds);
      } else {
        // Move to different stage
        const sourceAssignments = assignments
          .filter(a => a.stage_id === sourceStageId)
          .sort((a, b) => a.position - b.position);

        const draggedAssignment = sourceAssignments[source.index];
        
        if (draggedAssignment) {
          await moveClientToStage(
            draggedAssignment.id,
            destStageId,
            destination.index
          );
        }
      }
    }
  };

  const getStageAssignments = (stageId: string) => {
    return assignments
      .filter(assignment => assignment.stage_id === stageId)
      .sort((a, b) => a.position - b.position);
  };

  return (
    <div className="h-full overflow-hidden">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="board" type="stage" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex gap-6 h-full overflow-x-auto pb-4"
            >
              {stages.map((stage, index) => (
                <Draggable key={stage.id} draggableId={stage.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex-shrink-0 ${snapshot.isDragging ? 'opacity-50' : ''}`}
                    >
                      <KanbanColumn
                        stage={stage}
                        assignments={getStageAssignments(stage.id)}
                        dragHandleProps={provided.dragHandleProps}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
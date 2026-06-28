'use strict';

// ============ MAPPER: local model <-> Supabase rows ============
// Typed DB columns map directly; everything else lives in the JSONB `data`.

// ---- TASKS ----
export function taskToRow(t, userId) {
    return {
        id: t.id,
        user_id: userId,
        title: t.title || '',
        list: t.list || 'inbox',
        project_id: t.projectId || null,
        completed: !!t.completed,
        due_date: t.date || null,
        priority: t.priority || null,
        data: {
            notes: t.notes || '',
            context: t.context || '',
            energy: t.energy || '',
            timeEstimate: t.timeEstimate || '',
            time: t.time || '',
            waitingFor: t.waitingFor || '',
            tags: t.tags || [],
            subtasks: t.subtasks || [],
            completedAt: t.completedAt || null,
            activity: t.activity || []
        },
        created_at: t.createdAt || new Date().toISOString(),
        updated_at: t.updatedAt || new Date().toISOString(),
        deleted_at: t.deletedAt || null
    };
}

export function rowToTask(r) {
    const d = r.data || {};
    return {
        id: r.id,
        title: r.title || '',
        list: r.list || 'inbox',
        projectId: r.project_id || null,
        completed: !!r.completed,
        date: r.due_date || '',
        priority: r.priority || '',
        notes: d.notes || '',
        context: d.context || '',
        energy: d.energy || '',
        timeEstimate: d.timeEstimate || '',
        time: d.time || '',
        waitingFor: d.waitingFor || '',
        tags: d.tags || [],
        subtasks: d.subtasks || [],
        completedAt: d.completedAt || null,
        activity: d.activity || [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at || null
    };
}

// ---- PROJECTS ----
export function projectToRow(p, userId) {
    return {
        id: p.id,
        user_id: userId,
        title: p.title || '',
        description: p.description || null,
        color: p.color || null,
        deadline: p.deadline || null,
        created_at: p.createdAt || new Date().toISOString(),
        updated_at: p.updatedAt || new Date().toISOString(),
        deleted_at: p.deletedAt || null
    };
}

export function rowToProject(r) {
    return {
        id: r.id,
        title: r.title || '',
        description: r.description || '',
        color: r.color || '',
        deadline: r.deadline || '',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at || null
    };
}

// ---- TAGS ----
export function tagToRow(tag, userId) {
    return {
        id: tag.id,
        user_id: userId,
        name: tag.name || '',
        color: tag.color || null,
        created_at: tag.createdAt || new Date().toISOString(),
        updated_at: tag.updatedAt || new Date().toISOString(),
        deleted_at: tag.deletedAt || null
    };
}

export function rowToTag(r) {
    return {
        id: r.id,
        name: r.name || '',
        color: r.color || '',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at || null
    };
}

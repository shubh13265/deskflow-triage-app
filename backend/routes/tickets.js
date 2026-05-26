const express = require('express');
const router = express.Router();
const { Ticket, computeDerivedFields } = require('../models/Ticket');

const STATUS_ORDER = ['open', 'in_progress', 'resolved', 'closed'];

// POST /tickets - Create a ticket
router.post('/', async (req, res) => {
  try {
    const { subject, description, customerEmail, priority, status } = req.body;

    // Check required fields manually for cleaner validation response
    const missingFields = [];
    if (!subject) missingFields.push('subject');
    if (!description) missingFields.push('description');
    if (!customerEmail) missingFields.push('customerEmail');
    if (!priority) missingFields.push('priority');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Create ticket document (mongoose schema will run validations on email, priority, status)
    const ticket = new Ticket({
      subject,
      description,
      customerEmail,
      priority,
      status: status || 'open'
    });

    if (ticket.status === 'resolved') {
      ticket.resolvedAt = new Date();
    }

    await ticket.save();
    return res.status(201).json(ticket.toJSON());
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: messages.join('. ') });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /tickets - List tickets with combinable filters
router.post('/list-query', async (req, res) => {
  // We can support POST list-query or GET /tickets. Let's do both or just GET with query params.
});

// Let's implement GET /tickets
router.get('/', async (req, res) => {
  try {
    const { status, priority, breached } = req.query;

    const query = {};
    if (status) {
      if (!STATUS_ORDER.includes(status)) {
        return res.status(400).json({ error: 'Unknown status filter' });
      }
      query.status = status;
    }
    if (priority) {
      if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
        return res.status(400).json({ error: 'Unknown priority filter' });
      }
      query.priority = priority;
    }

    let tickets = await Ticket.find(query).sort({ createdAt: -1 });

    // Filter by breached in-memory since it's a derived field
    if (breached !== undefined) {
      const isBreachedFilter = breached === 'true';
      tickets = tickets.filter(ticket => {
        const obj = ticket.toJSON();
        return obj.slaBreached === isBreachedFilter;
      });
    }

    return res.json(tickets.map(t => t.toJSON()));
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /tickets/stats - Aggregate stats
router.get('/stats', async (req, res) => {
  try {
    const tickets = await Ticket.find({});
    
    const stats = {
      statusCounts: {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0
      },
      priorityCounts: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0
      },
      openBreachedCount: 0
    };

    tickets.forEach(ticket => {
      const obj = ticket.toJSON();
      
      // Update status counts
      if (stats.statusCounts[obj.status] !== undefined) {
        stats.statusCounts[obj.status]++;
      }
      
      // Update priority counts
      if (stats.priorityCounts[obj.priority] !== undefined) {
        stats.priorityCounts[obj.priority]++;
      }

      // Count SLA-breached tickets that are currently open (unresolved: open or in_progress)
      const isOpen = obj.status === 'open' || obj.status === 'in_progress';
      if (isOpen && obj.slaBreached) {
        stats.openBreachedCount++;
      }
    });

    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /tickets/:id - Update ticket (used to change status, subject, description, priority, email)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const { subject, description, customerEmail, priority, status } = req.body;

    // 1. Enforce status transition rules if status is changing
    if (status !== undefined && status !== ticket.status) {
      if (!STATUS_ORDER.includes(status)) {
        return res.status(400).json({ error: `Invalid status: ${status}` });
      }

      const oldIndex = STATUS_ORDER.indexOf(ticket.status);
      const newIndex = STATUS_ORDER.indexOf(status);

      const diff = newIndex - oldIndex;
      if (Math.abs(diff) !== 1) {
        return res.status(400).json({
          error: `Invalid status transition from '${ticket.status}' to '${status}'. You can only move to adjacent statuses.`
        });
      }

      // Automatically set resolvedAt when status moves to resolved
      if (status === 'resolved') {
        ticket.resolvedAt = new Date();
      }

      // Moving back from resolved must clear resolvedAt
      if (ticket.status === 'resolved' && status === 'in_progress') {
        ticket.resolvedAt = undefined;
      }

      ticket.status = status;
    }

    // Update other fields if provided
    if (subject !== undefined) ticket.subject = subject;
    if (description !== undefined) ticket.description = description;
    if (customerEmail !== undefined) ticket.customerEmail = customerEmail;
    
    if (priority !== undefined) {
      if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority value' });
      }
      ticket.priority = priority;
    }

    await ticket.save();
    return res.json(ticket.toJSON());
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: messages.join('. ') });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /tickets/:id - Delete a ticket
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findByIdAndDelete(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    return res.json({ message: 'Ticket deleted successfully', id });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
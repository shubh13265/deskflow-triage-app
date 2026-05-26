const mongoose = require('mongoose');

const SLA_TARGETS = {
  urgent: 60,      // 1 hour
  high: 240,       // 4 hours
  medium: 1440,    // 24 hours
  low: 4320        // 72 hours
};

const TicketSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Subject is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  customerEmail: {
    type: String,
    required: [true, 'Customer email is required'],
    validate: {
      validator: function(v) {
        // Simple but robust email regex
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  priority: {
    type: String,
    required: [true, 'Priority is required'],
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: 'Priority must be one of: low, medium, high, urgent'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['open', 'in_progress', 'resolved', 'closed'],
      message: 'Status must be one of: open, in_progress, resolved, closed'
    },
    default: 'open'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  }
});

// Calculate derived fields helper function
function computeDerivedFields(doc) {
  if (!doc) return null;
  const createdAtMs = new Date(doc.createdAt).getTime();
  const targetDate = doc.resolvedAt ? new Date(doc.resolvedAt) : new Date();
  const ageMs = targetDate.getTime() - createdAtMs;
  const ageMinutes = Math.floor(ageMs / (1000 * 60));

  const targetMinutes = SLA_TARGETS[doc.priority] || 0;
  
  // slaBreached is true if currently unresolved and age past target,
  // or if resolved/closed and resolved time is past target.
  const isResolved = doc.status === 'resolved' || doc.status === 'closed';
  
  let slaBreached = false;
  if (isResolved) {
    if (doc.resolvedAt) {
      const durationMs = new Date(doc.resolvedAt).getTime() - createdAtMs;
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      slaBreached = durationMinutes > targetMinutes;
    } else {
      // Edge case: if marked resolved but no resolvedAt, check current time
      slaBreached = ageMinutes > targetMinutes;
    }
  } else {
    slaBreached = ageMinutes > targetMinutes;
  }

  return {
    ageMinutes: Math.max(0, ageMinutes),
    slaBreached
  };
}

// Attach derived fields to JSON responses
TicketSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    const derived = computeDerivedFields(ret);
    if (derived) {
      ret.ageMinutes = derived.ageMinutes;
      ret.slaBreached = derived.slaBreached;
    }
    return ret;
  }
});

TicketSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    const derived = computeDerivedFields(ret);
    if (derived) {
      ret.ageMinutes = derived.ageMinutes;
      ret.slaBreached = derived.slaBreached;
    }
    return ret;
  }
});

module.exports = {
  Ticket: mongoose.model('Ticket', TicketSchema),
  computeDerivedFields,
  SLA_TARGETS
};
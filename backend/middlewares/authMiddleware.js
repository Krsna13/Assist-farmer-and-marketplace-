// authMiddleware.js
const jwt = require("jsonwebtoken");

/**
 * Extracts and verifies JWT from the Authorization header.
 * Attaches decoded user payload (including role with backward-compatible 'farmer' default) to req.user.
 * Returns HTTP 401 if token is missing, invalid, or expired.
 */
const authMiddleware = (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      token = authHeader; // Support raw token if provided directly
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Backward compatibility for legacy tokens: default to 'farmer'
    if (!decoded.role) {
      decoded.role = "farmer";
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token.", error: err.message });
  }
};

/**
 * Role-based authorization middleware generator.
 * Example usage:
 *   router.post("/farmer-only", authMiddleware, requireRole("farmer"), handler);
 *   router.post("/buyer-access", authMiddleware, requireRole("buyer", "bulk_buyer"), handler);
 *
 * If authMiddleware was not called prior, it will automatically authenticate the request first.
 * Returns HTTP 401 for unauthenticated requests, and HTTP 403 for authenticated users lacking the required role.
 */
const requireRole = (...allowedRoles) => {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    // If user is not yet authenticated, authenticate first
    if (!req.user) {
      return authMiddleware(req, res, () => {
        checkRole(req, res, next, roles);
      });
    }

    checkRole(req, res, next, roles);
  };
};

const checkRole = (req, res, next, roles) => {
  if (!req.user) {
    return res.status(401).json({ message: "Access denied. Authentication required." });
  }

  const currentRole = req.user.role || "farmer";
  if (!roles.includes(currentRole)) {
    return res.status(403).json({
      message: `Forbidden: role '${currentRole}' is not authorized to access this resource. Required role: [${roles.join(", ")}].`,
      requiredRoles: roles,
      currentRole: currentRole,
    });
  }

  next();
};

// Export as default function for backward compatibility with existing imports:
// const authMiddleware = require("../middlewares/authMiddleware");
authMiddleware.authMiddleware = authMiddleware;
authMiddleware.requireRole = requireRole;

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.requireRole = requireRole;

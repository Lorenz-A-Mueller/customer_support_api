const {
  AuthenticationError,
  UserInputError,
  ApolloError,
} = require('apollo-server-errors');
const crypto = require('node:crypto');
const { hashPassword, verifyPassword } = require('./auth.js');
const {
  parseCustomerSessionCookie,
  parseEmployeeSessionCookie,
} = require('./parseCookie');

const {
  getCustomers,
  getCustomerById,
  getCustomerByNumberWithHashedPassword,
  createCustomer,
  getEmployees,
  getEmployeeById,
  getEmployeeByNumberWithHashedPassword,
  createCustomerSession,
  createEmployeeSession,
  deleteExpiredCustomerSessions,
  deleteExpiredEmployeeSessions,
  deleteCustomerSessionByToken,
  getAllTickets,
  getUnclosedTicketByCustomerId,
  getTicketById,
  createTicket,
  deleteTicketById,
  changeTicketStatusByIdAndStatusId,
  getValidCustomerSessionByToken,
  getValidEmployeeSessionByToken,
  getMessageById,
  createMessage,
  createMessageWithResponderId,
  getMessages,
  getStatus,
  getStatuses,
  getCategories,
  getCategory,
  getTicketsByTimeFrame,
  deleteEmployeeSession,
  getPriority,
  getPriorities,
  getRoles,
  getRole,
  changeTicketPriorityByIdAndPriorityId,
  changeTicketAssigneeByIdAndEmployeeId,
} = require('./dbFunctions');

exports.resolvers = {
  Query: {
    customers: () => {
      return getCustomers();
    },
    customer: async (parent, args, context) => {
      if (args.search.id) return getCustomerById(args.search.id);
      if (args.search.number) {
        if (!args.search.number[0] || !args.search.number[1]) {
          throw new UserInputError('Password and Username are required!');
        }

        const hashedPasswordInDb = await getCustomerByNumberWithHashedPassword(
          args.search.number[0],
        );
        const passWordsMatch = await verifyPassword(
          args.search.number[1],
          hashedPasswordInDb.password_hashed,
        );
        if (passWordsMatch) {
          // destructure -> only return the customer without the hashed_password

          const { password_hashed, ...customerWithoutHashedPassword } =
            await getCustomerByNumberWithHashedPassword(args.search.number[0]);

          // clean ALL expired sessions

          deleteExpiredCustomerSessions();

          // generate a random token

          const token = crypto.randomBytes(64).toString('base64');

          // safe token and client id as a session in the DB

          const newSession = await createCustomerSession(
            token,
            customerWithoutHashedPassword.id,
          );

          // set token as cookie
          context.res.cookie('customerSessionToken', newSession.token, {
            httpOnly: true,
          });

          return customerWithoutHashedPassword;
          // context.res.sendStatus(200); // ???
        }

        throw new AuthenticationError(
          'Password/Username combination did not match!',
        );
      }
    },
    employees: () => {
      return getEmployees();
    },
    employee: async (parent, args, context) => {
      if (args.search.id) return getEmployeeById(args.search.id);
      if (args.search.number) {
        if (!args.search.number[0] || !args.search.number[1]) {
          console.log('this');
          throw new UserInputError(
            'Employee Number and Password are required!',
          );
        }
        console.log('here');

        const hashedPasswordInDb = await getEmployeeByNumberWithHashedPassword(
          args.search.number[0],
        );

        const passWordsMatch = await verifyPassword(
          args.search.number[1],
          hashedPasswordInDb.password_hashed,
        );
        if (passWordsMatch) {
          // destructure -> only return the employee without the hashed_password

          const { password_hashed, ...employeeWithoutHashedPassword } =
            await getEmployeeByNumberWithHashedPassword(args.search.number[0]);

          // clean ALL expired sessions

          deleteExpiredEmployeeSessions();

          // generate a random token

          const token = crypto.randomBytes(64).toString('base64');

          // safe token and client id as a session in the DB

          const newSession = await createEmployeeSession(
            token,
            employeeWithoutHashedPassword.id,
          );

          // set token as cookie

          context.res.cookie('employeeSessionToken', newSession.token, {
            httpOnly: true,
          });

          return employeeWithoutHashedPassword;
          // context.res.sendStatus(200); // ???
        }
        throw new AuthenticationError(
          'Employee Number / Password combination did not match!',
        );
      }
    },
    customerSession: (parent, args, context) => {
      // context.req.headers.cookie is a large string that contains all cookies, must get parsed first
      const cookiesString = context.req.headers.cookie;
      const sessionToken = parseCustomerSessionCookie(cookiesString);
      return getValidCustomerSessionByToken(sessionToken);
    },
    employeeSession: async (parent, args, context) => {
      // context.req.header.cookie only includes the sessionCookie (parsed already via next.js)
      const sessionCookie = context.req.headers.cookie;
      const validationResult = await getValidEmployeeSessionByToken(
        sessionCookie,
      );
      console.log('validationResult: ', validationResult);
      if (typeof validationResult === 'undefined') {
        console.log('here');
        throw new UserInputError('yes');
        // throw new AuthenticationError('not authenticated');
      } else {
        console.log('there');
        return validationResult;
      }
    },
    deleteAllExpiredCustomerSessions: () => {
      return deleteExpiredCustomerSessions();
    },
    tickets: () => {
      return getAllTickets();
    },
    ticket: (parent, args) => {
      if (args.search.id) return getTicketById(args.search.id);
      if (args.search.customer_id) {
        return getUnclosedTicketByCustomerId(args.search.customer_id);
      }
    },
    ticketsByTimeFrame: (parent, args) => {
      return getTicketsByTimeFrame(args.startTime, args.endTime);
    },
    message: (parent, args) => {
      return getMessageById(args.id);
    },
    messages: (parent, args) => {
      return getMessages(args.ticket_id);
    },
    status: (parent, args) => {
      return getStatus(args.id);
    },
    statuses: () => {
      return getStatuses();
    },
    category: (parent, args) => {
      return getCategory(args.id);
    },
    categories: () => {
      return getCategories();
    },
    priority: (parent, args) => {
      return getPriority(args.id);
    },
    priorities: () => {
      return getPriorities();
    },
    roles: () => {
      return getRoles();
    },
    role: (parent, args) => {
      return getRole(args.id);
    },
  },
  Mutation: {
    createCustomer: async (parent, args) => {
      // #TODO
      args.password = await hashPassword(args.password);
      return createCustomer(
        args.first_name,
        args.last_name,
        args.email,
        args.password,
        args.phone_number,
        args.dob,
      );
    },
    createNewTicket: (parent, args) => {
      return createTicket(args.customer_id, args.category, args.title);
    },
    createNewMessage: (parent, args) => {
      return createMessage(args.ticket_id, args.content);
    },
    createNewMessageWithResponderId: (parent, args) => {
      return createMessageWithResponderId(
        args.ticket_id,
        args.content,
        args.responder_id,
      );
    },
    deleteEmployeeSession: (parent, args, context) => {
      const cookiesString = context.req.headers.cookie;
      const sessionToken = parseEmployeeSessionCookie(cookiesString);
      return deleteEmployeeSession(sessionToken);
    },
    deleteCustomerSession: (parent, args, context) => {
      const cookiesString = context.req.headers.cookie;
      const sessionToken = parseCustomerSessionCookie(cookiesString);
      return deleteCustomerSessionByToken(sessionToken);
    },
    deleteTicket: (parent, args) => {
      return deleteTicketById(args.id);
    },
    changeTicketStatus: (parent, args) => {
      return changeTicketStatusByIdAndStatusId(args.id, args.status);
    },
    changeTicketPriority: (parent, args) => {
      return changeTicketPriorityByIdAndPriorityId(args.id, args.priority);
    },
    changeTicketAssignee: (parent, args) => {
      return changeTicketAssigneeByIdAndEmployeeId(args.id, args.assignee_id);
    },
  },
};

// RQE3MLW/wyZstX7Sop4Cmj/N9AxWVXgFA6gd0zuCfYSTxnMoZWMOAQHjqLJTDU26DzjjhfcXaknPqHyE30n35A==;
// RQE3MLW/wyZstX7Sop4Cmj/N9AxWVXgFA6gd0zuCfYSTxnMoZWMOAQHjqLJTDU26DzjjhfcXaknPqHyE30n35A==

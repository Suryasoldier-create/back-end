import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Context for Firebase services and user data
const FirebaseContext = createContext(null);

// Firebase Provider Component
const FirebaseProvider = ({ children }) => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const firebaseAuth = getAuth(app);

        setDb(firestore);
        setAuth(firebaseAuth);

        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                setCurrentUser(user);
                setUserId(user.uid);
                // Fetch user profile to check admin status
                const userProfileRef = doc(firestore, `artifacts/${appId}/users/${user.uid}/profile`);
                const userProfileSnap = await getDoc(userProfileRef);
                if (userProfileSnap.exists()) {
                    setIsAdmin(userProfileSnap.data().isAdmin || false);
                } else {
                    // Create a basic profile if it doesn't exist
                    await setDoc(userProfileRef, { email: user.email || 'anonymous', isAdmin: false });
                    setIsAdmin(false);
                }
            } else {
                setCurrentUser(null);
                setUserId(null);
                setIsAdmin(false);
            }
            setLoading(false);
        });

        // Initial sign-in
        const signIn = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(firebaseAuth, initialAuthToken);
                } else {
                    await signInAnonymously(firebaseAuth);
                }
            } catch (error) {
                console.error("Error signing in:", error);
            }
        };
        signIn();

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-lg font-semibold text-gray-700">Loading application...</div>
            </div>
        );
    }

    return (
        <FirebaseContext.Provider value={{ db, auth, currentUser, userId, isAdmin }}>
            {children}
        </FirebaseContext.Provider>
    );
};

// Custom hook to use Firebase context
const useFirebase = () => {
    const context = useContext(FirebaseContext);
    if (!context) {
        throw new Error('useFirebase must be used within a FirebaseProvider');
    }
    return context;
};

// Event Card Component
const EventCard = ({ event, onRegister, onCancelRegistration, isRegistered, isCreator, onEdit, onDelete, isAdminView, onApprove, onReject }) => {
    const { userId } = useFirebase();
    const isFull = event.attendees.length >= event.capacity;
    const isPastEvent = new Date(`${event.date}T${event.time}`) < new Date();

    return (
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200 flex flex-col justify-between">
            <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{event.title}</h3>
                <p className="text-gray-600 mb-2">{event.description}</p>
                <p className="text-gray-700 font-medium">Date: {event.date} at {event.time}</p>
                <p className="text-gray-700 font-medium">Location: {event.location}</p>
                <p className="text-gray-700 font-medium">Capacity: {event.attendees.length}/{event.capacity}</p>
                <p className={`text-sm font-semibold mt-1 ${event.status === 'approved' ? 'text-green-600' : event.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                    Status: {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </p>
                <p className="text-xs text-gray-500 mt-2">Creator: {event.creatorEmail}</p>
                <p className="text-xs text-gray-500">Event ID: {event.id}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {isAdminView ? (
                    <>
                        {event.status === 'pending' && (
                            <>
                                <button
                                    onClick={() => onApprove(event.id)}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm"
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => onReject(event.id)}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm"
                                >
                                    Reject
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => onDelete(event.id)}
                            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm"
                        >
                            Delete Event
                        </button>
                    </>
                ) : (
                    <>
                        {event.status === 'approved' && !isPastEvent && (
                            <>
                                {isRegistered ? (
                                    <button
                                        onClick={() => onCancelRegistration(event.id)}
                                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm"
                                    >
                                        Cancel Registration
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onRegister(event.id)}
                                        disabled={isFull}
                                        className={`font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm ${
                                            isFull ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                    >
                                        {isFull ? 'Full' : 'Register'}
                                    </button>
                                )}
                            </>
                        )}
                        {isCreator && (
                            <>
                                <button
                                    onClick={() => onEdit(event)}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => onDelete(event.id)}
                                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm"
                                >
                                    Delete
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// Modal Component for Create/Edit Event
const EventModal = ({ eventToEdit, onClose, onSave }) => {
    const [title, setTitle] = useState(eventToEdit?.title || '');
    const [description, setDescription] = useState(eventToEdit?.description || '');
    const [date, setDate] = useState(eventToEdit?.date || '');
    const [time, setTime] = useState(eventToEdit?.time || '');
    const [location, setLocation] = useState(eventToEdit?.location || '');
    const [capacity, setCapacity] = useState(eventToEdit?.capacity || 10);
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!title || !description || !date || !time || !location || capacity <= 0) {
            setError('All fields are required and capacity must be greater than 0.');
            return;
        }

        const eventData = { title, description, date, time, location, capacity: Number(capacity) };
        onSave(eventData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                    {eventToEdit ? 'Edit Event' : 'Create New Event'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-gray-700 text-sm font-bold mb-2">Title:</label>
                        <input
                            type="text"
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">Description:</label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                            required
                        ></textarea>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="date" className="block text-gray-700 text-sm font-bold mb-2">Date:</label>
                            <input
                                type="date"
                                id="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="time" className="block text-gray-700 text-sm font-bold mb-2">Time:</label>
                            <input
                                type="time"
                                id="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="location" className="block text-gray-700 text-sm font-bold mb-2">Location:</label>
                        <input
                            type="text"
                            id="location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="capacity" className="block text-gray-700 text-sm font-bold mb-2">Capacity:</label>
                        <input
                            type="number"
                            id="capacity"
                            value={capacity}
                            onChange={(e) => setCapacity(e.target.value)}
                            min="1"
                            className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    <div className="flex justify-end gap-4 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm"
                        >
                            Save Event
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Confirmation Modal
const ConfirmationModal = ({ message, onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-sm text-center">
                <p className="text-lg text-gray-800 mb-6">{message}</p>
                <div className="flex justify-center gap-4">
                    <button
                        onClick={onCancel}
                        className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm"
                    >
                        No
                    </button>
                    <button
                        onClick={onConfirm}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm"
                    >
                        Yes
                    </button>
                </div>
            </div>
        </div>
    );
};


function App() {
    const { db, auth, currentUser, userId, isAdmin } = useFirebase();
    const [events, setEvents] = useState([]);
    const [filterDate, setFilterDate] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [eventToEdit, setEventToEdit] = useState(null);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [message, setMessage] = useState(''); // For general messages/errors

    // Fetch events from Firestore
    useEffect(() => {
        if (!db) return;

        const eventsCollectionRef = collection(db, `artifacts/${appId}/public/data/events`);
        const q = query(eventsCollectionRef); // Fetch all events, then filter client-side

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEvents(eventsData);
        }, (error) => {
            console.error("Error fetching events:", error);
            setMessage("Error fetching events. Please try again.");
        });

        return () => unsubscribe();
    }, [db]);

    // Helper to show message
    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000); // Clear message after 3 seconds
    };

    // Event Creation/Update
    const handleSaveEvent = async (eventData) => {
        if (!currentUser) {
            showMessage("You must be logged in to create or edit events.");
            return;
        }

        try {
            if (eventToEdit) {
                // Update existing event
                await updateDoc(doc(db, `artifacts/${appId}/public/data/events`, eventToEdit.id), eventData);
                showMessage("Event updated successfully!");
            } else {
                // Create new event
                await addDoc(collection(db, `artifacts/${appId}/public/data/events`), {
                    ...eventData,
                    creatorId: userId,
                    creatorEmail: currentUser.email || 'anonymous',
                    status: 'pending', // New events are pending approval
                    attendees: []
                });
                showMessage("Event created successfully! Awaiting admin approval.");
            }
            setEventToEdit(null);
            setShowCreateModal(false);
        } catch (error) {
            console.error("Error saving event:", error);
            showMessage(`Error saving event: ${error.message}`);
        }
    };

    // Event Deletion
    const handleDeleteEvent = (eventId) => {
        setConfirmMessage("Are you sure you want to delete this event? This action cannot be undone.");
        setConfirmAction(() => async () => {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/events`, eventId));
                showMessage("Event deleted successfully!");
            } catch (error) {
                console.error("Error deleting event:", error);
                showMessage(`Error deleting event: ${error.message}`);
            } finally {
                setShowConfirmationModal(false);
                setConfirmAction(null);
            }
        });
        setShowConfirmationModal(true);
    };

    // Event Registration
    const handleRegister = async (eventId) => {
        if (!currentUser) {
            showMessage("You must be logged in to register for events.");
            return;
        }

        try {
            const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
            const eventSnap = await getDoc(eventRef);

            if (!eventSnap.exists()) {
                showMessage("Event not found.");
                return;
            }

            const eventData = eventSnap.data();
            const currentAttendees = eventData.attendees || [];

            if (currentAttendees.includes(userId)) {
                showMessage("You are already registered for this event.");
                return;
            }
            if (currentAttendees.length >= eventData.capacity) {
                showMessage("This event is full.");
                return;
            }

            // Update event attendees
            await updateDoc(eventRef, {
                attendees: [...currentAttendees, userId]
            });

            // Add registration record
            await setDoc(doc(db, `artifacts/${appId}/users/${userId}/registrations`, eventId), {
                eventId: eventId,
                registeredAt: new Date().toISOString()
            });

            showMessage("Successfully registered for the event!");
        } catch (error) {
            console.error("Error registering:", error);
            showMessage(`Error registering: ${error.message}`);
        }
    };

    // Cancel Registration
    const handleCancelRegistration = (eventId) => {
        setConfirmMessage("Are you sure you want to cancel your registration for this event?");
        setConfirmAction(() => async () => {
            if (!currentUser) {
                showMessage("You must be logged in to cancel registration.");
                setShowConfirmationModal(false);
                setConfirmAction(null);
                return;
            }

            try {
                const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
                const eventSnap = await getDoc(eventRef);

                if (!eventSnap.exists()) {
                    showMessage("Event not found.");
                    return;
                }

                const eventData = eventSnap.data();
                const currentAttendees = eventData.attendees || [];
                const updatedAttendees = currentAttendees.filter(id => id !== userId);

                if (updatedAttendees.length === currentAttendees.length) {
                    showMessage("You are not registered for this event.");
                    return;
                }

                // Update event attendees
                await updateDoc(eventRef, {
                    attendees: updatedAttendees
                });

                // Delete registration record
                await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/registrations`, eventId));

                showMessage("Registration cancelled successfully!");
            } catch (error) {
                console.error("Error cancelling registration:", error);
                showMessage(`Error cancelling registration: ${error.message}`);
            } finally {
                setShowConfirmationModal(false);
                setConfirmAction(null);
            }
        });
        setShowConfirmationModal(true);
    };


    // Admin Actions
    const handleApproveEvent = async (eventId) => {
        if (!isAdmin) {
            showMessage("You are not authorized to approve events.");
            return;
        }
        try {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/events`, eventId), { status: 'approved' });
            showMessage("Event approved successfully!");
        } catch (error) {
            console.error("Error approving event:", error);
            showMessage(`Error approving event: ${error.message}`);
        }
    };

    const handleRejectEvent = async (eventId) => {
        if (!isAdmin) {
            showMessage("You are not authorized to reject events.");
            return;
        }
        try {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/events`, eventId), { status: 'rejected' });
            showMessage("Event rejected successfully!");
        } catch (error) {
            console.error("Error rejecting event:", error);
            showMessage(`Error rejecting event: ${error.message}`);
        }
    };

    // Filtered events
    const filteredEvents = events.filter(event => {
        const matchesDate = filterDate ? event.date === filterDate : true;
        const matchesLocation = filterLocation ? event.location.toLowerCase().includes(filterLocation.toLowerCase()) : true;
        return matchesDate && matchesLocation;
    });

    // Determine which events to show based on tab
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'myEvents', 'myRegistrations', 'adminPending'

    const displayedEvents = filteredEvents.filter(event => {
        if (activeTab === 'all') {
            return event.status === 'approved'; // Only show approved events to general users
        } else if (activeTab === 'myEvents') {
            return event.creatorId === userId;
        } else if (activeTab === 'myRegistrations') {
            return event.attendees.includes(userId);
        } else if (activeTab === 'adminPending') {
            return isAdmin && event.status === 'pending'; // Only pending events for admin
        }
        return false;
    });

    const handleLogout = async () => {
        try {
            await signOut(auth);
            showMessage("Logged out successfully.");
        } catch (error) {
            console.error("Error logging out:", error);
            showMessage(`Error logging out: ${error.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-900 p-4 sm:p-6 lg:p-8">
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                body {
                    font-family: 'Inter', sans-serif;
                }
                `}
            </style>
            <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-8 lg:p-10 border border-gray-200">
                <header className="flex flex-col sm:flex-row justify-between items-center mb-8 pb-4 border-b border-gray-200">
                    <h1 className="text-4xl font-extrabold text-blue-700 mb-4 sm:mb-0">Event Hub</h1>
                    <div className="flex items-center space-x-4">
                        {currentUser && (
                            <span className="text-gray-700 font-medium">
                                Welcome, {currentUser.email || 'Anonymous User'} (ID: {userId})
                            </span>
                        )}
                        <button
                            onClick={handleLogout}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-sm"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                {message && (
                    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-md relative mb-6 text-center" role="alert">
                        <span className="block sm:inline">{message}</span>
                    </div>
                )}

                <nav className="mb-8 border-b border-gray-200 pb-4">
                    <ul className="flex flex-wrap justify-center sm:justify-start gap-3 sm:gap-4">
                        <li>
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                All Approved Events
                            </button>
                        </li>
                        {currentUser && (
                            <>
                                <li>
                                    <button
                                        onClick={() => setActiveTab('myEvents')}
                                        className={`py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'myEvents' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                    >
                                        My Created Events
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => setActiveTab('myRegistrations')}
                                        className={`py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'myRegistrations' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                    >
                                        My Registrations
                                    </button>
                                </li>
                            </>
                        )}
                        {isAdmin && (
                            <li>
                                <button
                                    onClick={() => setActiveTab('adminPending')}
                                    className={`py-2 px-4 rounded-md font-semibold transition duration-300 ${activeTab === 'adminPending' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                    Admin: Pending Events
                                </button>
                            </li>
                        )}
                    </ul>
                </nav>

                <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                    <button
                        onClick={() => { setEventToEdit(null); setShowCreateModal(true); }}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 shadow-md w-full sm:w-auto"
                    >
                        Create New Event
                    </button>
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        <input
                            type="date"
                            placeholder="Filter by Date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
                        />
                        <input
                            type="text"
                            placeholder="Filter by Location"
                            value={filterLocation}
                            onChange={(e) => setFilterLocation(e.target.value)}
                            className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
                        />
                    </div>
                </div>

                <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-3">
                    {activeTab === 'all' && 'All Approved Events'}
                    {activeTab === 'myEvents' && 'My Created Events'}
                    {activeTab === 'myRegistrations' && 'My Registered Events'}
                    {activeTab === 'adminPending' && 'Pending Events for Approval'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayedEvents.length > 0 ? (
                        displayedEvents.map(event => (
                            <EventCard
                                key={event.id}
                                event={event}
                                onRegister={handleRegister}
                                onCancelRegistration={handleCancelRegistration}
                                isRegistered={event.attendees.includes(userId)}
                                isCreator={event.creatorId === userId}
                                onEdit={(event) => { setEventToEdit(event); setShowCreateModal(true); }}
                                onDelete={handleDeleteEvent}
                                isAdminView={activeTab === 'adminPending'}
                                onApprove={handleApproveEvent}
                                onReject={handleRejectEvent}
                            />
                        ))
                    ) : (
                        <p className="col-span-full text-center text-gray-600 text-lg py-10">
                            No events found for this view or filter.
                        </p>
                    )}
                </div>
            </div>

            {showCreateModal && (
                <EventModal
                    eventToEdit={eventToEdit}
                    onClose={() => { setShowCreateModal(false); setEventToEdit(null); }}
                    onSave={handleSaveEvent}
                />
            )}

            {showConfirmationModal && (
                <ConfirmationModal
                    message={confirmMessage}
                    onConfirm={confirmAction}
                    onCancel={() => { setShowConfirmationModal(false); setConfirmAction(null); }}
                />
            )}
        </div>
    );
}

// Main component wrapped with Firebase Provider
export default function ProvidedApp() {
    return (
        <FirebaseProvider>
            <App />
        </FirebaseProvider>
    );
}

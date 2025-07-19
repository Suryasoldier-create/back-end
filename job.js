import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

// --- Firebase Context ---
// Create a context to provide Firebase instances and user ID to child components
const FirebaseContext = createContext(null);

// Custom hook to use Firebase context
const useFirebase = () => useContext(FirebaseContext);

// --- Modal Component ---
// A reusable modal component for confirmations or input forms
const Modal = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative transform transition-all duration-300 scale-100 opacity-100">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold rounded-full w-8 h-8 flex items-center justify-center"
          aria-label="Close modal"
        >
          &times;
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">{title}</h2>
        <div className="mb-6">{children}</div>
        {footer && <div className="border-t pt-4 flex justify-end space-x-3">{footer}</div>}
      </div>
    </div>
  );
};

// --- Job Card Component ---
// Displays details of a single job
const JobCard = ({ job, onApply }) => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200 hover:shadow-lg transition-shadow duration-200">
    <h3 className="text-xl font-semibold text-gray-800 mb-2">{job.title}</h3>
    <p className="text-gray-600 mb-1">
      <span className="font-medium">Company:</span> {job.company}
    </p>
    <p className="text-gray-600 mb-3">
      <span className="font-medium">Location:</span> {job.location}
    </p>
    <p className="text-gray-700 text-sm leading-relaxed mb-4">{job.description}</p>
    <button
      onClick={() => onApply(job)}
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
    >
      Apply Now
    </button>
  </div>
);

// --- Application Card Component ---
// Displays details of a user's application
const ApplicationCard = ({ application, onDelete }) => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-lg transition-shadow duration-200">
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">{application.jobTitle}</h3>
      <p className="text-gray-600 mb-1">
        <span className="font-medium">Applicant:</span> {application.applicantName} ({application.applicantEmail})
      </p>
      <p className="text-gray-600 text-sm">
        <span className="font-medium">Applied On:</span>{' '}
        {application.appliedAt ? new Date(application.appliedAt.toDate()).toLocaleString() : 'N/A'}
      </p>
    </div>
    <button
      onClick={() => onDelete(application.id)}
      className="mt-4 sm:mt-0 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
    >
      Delete Application
    </button>
  </div>
);

// --- Job List Component ---
// Displays all available jobs and handles application logic
const JobList = ({ jobs, onApplyJob }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyClick = (job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
    setApplyError('');
    setApplySuccess('');
    setApplicantName('');
    setApplicantEmail('');
  };

  const handleSubmitApplication = async () => {
    if (!applicantName || !applicantEmail) {
      setApplyError('Please fill in both name and email.');
      return;
    }
    setApplyError('');
    setApplySuccess('');
    setIsApplying(true);

    try {
      await onApplyJob(selectedJob.id, selectedJob.title, applicantName, applicantEmail);
      setApplySuccess('Application submitted successfully!');
      setTimeout(() => {
        setIsModalOpen(false);
        setApplySuccess('');
      }, 2000); // Close modal after 2 seconds
    } catch (error) {
      console.error('Error submitting application:', error);
      setApplyError('Failed to submit application. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 rounded-lg shadow-inner">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Available Jobs</h2>
      {jobs.length === 0 ? (
        <p className="text-gray-600">No jobs available at the moment.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onApply={handleApplyClick} />
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Apply for: ${selectedJob?.title}`}
        footer={
          <>
            <button
              onClick={() => setIsModalOpen(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200"
              disabled={isApplying}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitApplication}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isApplying}
            >
              {isApplying ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </div>
              ) : (
                'Submit Application'
              )}
            </button>
          </>
        }
      >
        {applyError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {applyError}</span>
          </div>
        )}
        {applySuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Success!</strong>
            <span className="block sm:inline"> {applySuccess}</span>
          </div>
        )}
        <div className="mb-4">
          <label htmlFor="applicant-name" className="block text-gray-700 text-sm font-bold mb-2">
            Your Name:
          </label>
          <input
            type="text"
            id="applicant-name"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            disabled={isApplying}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="applicant-email" className="block text-gray-700 text-sm font-bold mb-2">
            Your Email:
          </label>
          <input
            type="email"
            id="applicant-email"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
            value={applicantEmail}
            onChange={(e) => setApplicantEmail(e.target.value)}
            disabled={isApplying}
          />
        </div>
      </Modal>
    </div>
  );
};

// --- Applied Jobs Component ---
// Displays user's applied jobs and handles deletion
const AppliedJobs = ({ applications, onDeleteApplication }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (appId) => {
    setAppToDelete(appId);
    setIsModalOpen(true);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!appToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await onDeleteApplication(appToDelete);
      setIsModalOpen(false);
      setAppToDelete(null);
    } catch (error) {
      console.error('Error deleting application:', error);
      setDeleteError('Failed to delete application. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 rounded-lg shadow-inner">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Your Applications</h2>
      {applications.length === 0 ? (
        <p className="text-gray-600">You haven't applied for any jobs yet.</p>
      ) : (
        <div>
          {applications.map((app) => (
            <ApplicationCard key={app.id} application={app} onDelete={handleDeleteClick} />
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Confirm Deletion"
        footer={
          <>
            <button
              onClick={() => setIsModalOpen(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </div>
              ) : (
                'Confirm Delete'
              )}
            </button>
          </>
        }
      >
        {deleteError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {deleteError}</span>
          </div>
        )}
        <p className="text-gray-700">Are you sure you want to delete this application?</p>
      </Modal>
    </div>
  );
};

// --- Main App Component ---
const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [error, setError] = useState('');

  // Pre-defined jobs (in a real app, these would be managed by an admin)
  const predefinedJobs = [
    { id: 'job1', title: 'Software Engineer', company: 'Tech Solutions Inc.', location: 'Bangalore, India', description: 'Develop and maintain high-performance software applications.' },
    { id: 'job2', title: 'Product Manager', company: 'Innovate Corp', location: 'Mumbai, India', description: 'Define product vision, strategy, and roadmap.' },
    { id: 'job3', title: 'UX Designer', company: 'Creative Studio', location: 'Delhi, India', description: 'Design intuitive and engaging user experiences.' },
    { id: 'job4', title: 'Data Scientist', company: 'Analytics Hub', location: 'Hyderabad, India', description: 'Analyze complex data sets to extract actionable insights.' },
    { id: 'job5', title: 'Marketing Specialist', company: 'Global Brands', location: 'Chennai, India', description: 'Develop and execute marketing campaigns across various channels.' },
  ];

  // Initialize Firebase and handle authentication
  useEffect(() => {
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

      if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
        setError("Firebase configuration is missing. Please ensure '__firebase_config' is provided.");
        return;
      }

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // If no user, try to sign in with custom token or anonymously
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            try {
              await signInWithCustomToken(firebaseAuth, __initial_auth_token);
              setUserId(firebaseAuth.currentUser?.uid);
            } catch (error) {
              console.error('Error signing in with custom token:', error);
              setError('Authentication failed. Please try refreshing the page.');
              await signInAnonymously(firebaseAuth); // Fallback to anonymous
              setUserId(firebaseAuth.currentUser?.uid || crypto.randomUUID());
            }
          } else {
            await signInAnonymously(firebaseAuth);
            setUserId(firebaseAuth.currentUser?.uid || crypto.randomUUID()); // Fallback if anonymous fails
          }
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe(); // Cleanup auth listener
    } catch (err) {
      console.error('Failed to initialize Firebase:', err);
      setError(`Failed to initialize application: ${err.message}`);
    }
  }, []);

  // Load jobs (pre-defined for this example)
  useEffect(() => {
    if (db && isAuthReady) {
      setJobs(predefinedJobs);
      setLoadingJobs(false);
      // In a real app, you might fetch from Firestore:
      // const fetchJobs = async () => {
      //   try {
      //     const jobsColRef = collection(db, `artifacts/${__app_id}/public/data/jobs`);
      //     const jobSnapshot = await getDocs(jobsColRef);
      //     const jobList = jobSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      //     setJobs(jobList);
      //   } catch (err) {
      //     console.error('Error fetching jobs:', err);
      //     setError('Failed to load jobs.');
      //   } finally {
      //     setLoadingJobs(false);
      //   }
      // };
      // fetchJobs();
    }
  }, [db, isAuthReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for user applications in real-time
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const applicationsColRef = collection(db, `artifacts/${__app_id}/users/${userId}/applications`);
      const q = query(applicationsColRef); // No orderBy to avoid index issues

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const apps = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setApplications(apps);
        setLoadingApplications(false);
      }, (err) => {
        console.error('Error listening to applications:', err);
        setError('Failed to load your applications in real-time.');
        setLoadingApplications(false);
      });

      return () => unsubscribe(); // Cleanup listener
    }
  }, [db, userId, isAuthReady]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Handles applying for a job.
   * Adds a new application document to Firestore.
   * @param {string} jobId - The ID of the job being applied for.
   * @param {string} jobTitle - The title of the job.
   * @param {string} applicantName - The name of the applicant.
   * @param {string} applicantEmail - The email of the applicant.
   */
  const handleApplyJob = async (jobId, jobTitle, applicantName, applicantEmail) => {
    if (!db || !userId) {
      setError('Database not ready or user not authenticated.');
      return;
    }
    try {
      const applicationsColRef = collection(db, `artifacts/${__app_id}/users/${userId}/applications`);
      await addDoc(applicationsColRef, {
        jobId,
        jobTitle,
        applicantName,
        applicantEmail,
        appliedAt: serverTimestamp(), // Use server timestamp for consistency
      });
    } catch (err) {
      console.error('Error applying for job:', err);
      throw new Error('Failed to submit application.');
    }
  };

  /**
   * Handles deleting an application.
   * Deletes an application document from Firestore.
   * @param {string} applicationId - The ID of the application to delete.
   */
  const handleDeleteApplication = async (applicationId) => {
    if (!db || !userId) {
      setError('Database not ready or user not authenticated.');
      return;
    }
    try {
      const appDocRef = doc(db, `artifacts/${__app_id}/users/${userId}/applications`, applicationId);
      await deleteDoc(appDocRef);
    } catch (err) {
      console.error('Error deleting application:', err);
      throw new Error('Failed to delete application.');
    }
  };

  // Filter jobs based on search query
  const filteredJobs = jobs.filter(job =>
    job.title.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
    job.company.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
    job.location.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
    job.description.toLowerCase().includes(jobSearchQuery.toLowerCase())
  );

  if (!isAuthReady || loadingJobs || loadingApplications) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-800 to-indigo-900 flex items-center justify-center text-white text-xl font-semibold">
        <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading Job Portal...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-red-800 flex items-center justify-center text-white text-xl font-semibold p-4">
        Error: {error}
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={{ db, auth, userId }}>
      <div className="min-h-screen bg-gradient-to-br from-blue-800 to-indigo-900 p-4 font-inter text-gray-800">
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8">
          <h1 className="text-4xl font-extrabold text-center text-blue-800 mb-8">
            Job Portal Management System
          </h1>

          <div className="text-center text-gray-600 mb-6">
            <p className="mb-2">Welcome to the Job Portal! Your User ID for this session is:</p>
            <p className="font-mono bg-gray-100 p-2 rounded-md inline-block text-sm select-all">
              {userId}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              (Share this ID if you want to collaborate or identify yourself)
            </p>
          </div>

          {/* Job Search Input */}
          <div className="mb-8 p-6 bg-blue-50 rounded-lg shadow-inner">
            <h2 className="text-2xl font-bold text-blue-800 mb-4">Search Jobs</h2>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-lg border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ease-in-out text-gray-800 text-lg"
              placeholder="Search by title, company, location, or description..."
              value={jobSearchQuery}
              onChange={(e) => setJobSearchQuery(e.target.value)}
            />
          </div>

          {/* Available Jobs Section */}
          <section className="mb-10">
            <JobList jobs={filteredJobs} onApplyJob={handleApplyJob} />
          </section>

          {/* Applied Jobs Section */}
          <section>
            <AppliedJobs applications={applications} onDeleteApplication={handleDeleteApplication} />
          </section>
        </div>
      </div>
    </FirebaseContext.Provider>
  );
};

export default App;

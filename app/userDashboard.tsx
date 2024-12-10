import { Text, View, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, TextInput,Dimensions, Platform } from "react-native";
import { useState, useRef, useEffect } from "react";
import { WebView } from 'react-native-webview';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from "./config";
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface Transaction {
  _id: string;
  amount: number;
  status: string;
  purpose: string;
  dueDate: string;
  paymentDate: string;
  billNumber: string;
  billType: string;
}

interface PendingTransaction {
  amount: number;
  purpose: string;
  paymentDate: string;
}

interface UserData {
  uniqueId: string;
  role: string;
}

interface Banner {
  id: number;
  imageUrl: string;
}

interface ComplaintStats {
  resolved: number;
  pending: number;
}

interface ComplaintForm {
  title: string;
  location: string;
  description: string;
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  image: string | null;
}

const banners: Banner[] = [
  {
    id: 1,
    imageUrl: 'https://jalshakti-ddws.gov.in/sites/default/files/Jal-Jeevan-Mission-Pledge-Website1.jpg'  // Replace with your banner URLs
  },
  {
    id: 2,
    imageUrl: 'https://jalshakti-ddws.gov.in/sites/default/files/15-cr-en.jpg'
  },
  {
    id: 3,
    imageUrl: 'https://www.en.etemaaddaily.com/pages/world/hyderabad/9465ministryofjalshakti.png'
  }
];

const PaymentSection = ({ 
  onPayment, 
  pendingTransaction,
  refreshing 
}: { 
  onPayment: () => void;
  pendingTransaction?: PendingTransaction;
  refreshing?: boolean;
}) => (
  <View>
    <Text style={styles.sectionTitle}>Payment Details</Text>
    {pendingTransaction ? (
      <View style={styles.paymentCard}>
        <Text style={styles.paymentLabel}>Pending Bill Amount</Text>
        <Text style={styles.paymentAmount}>₹{pendingTransaction.amount/100}.00</Text>
        <Text style={styles.paymentDue}>Due Date: {new Date(pendingTransaction.paymentDate).toLocaleDateString()}</Text>
        <Text style={styles.paymentPurpose}>{pendingTransaction.purpose}</Text>
        <TouchableOpacity 
          style={styles.payButton}
          onPress={onPayment}
        >
          <Text style={styles.payButtonText}>Pay Now</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={styles.paymentCard}>
        <Text style={styles.noPaymentText}>No pending payments</Text>
      </View>
    )}
  </View>
);

const ComplaintSection = () => {
  const [stats, setStats] = useState<ComplaintStats>({
    resolved: 0,
    pending: 0
  });
  const [complaintForm, setComplaintForm] = useState<ComplaintForm>({
    title: '',
    location: '',
    description: '',
    coordinates: null,
    image: null
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchComplaintStats();
  }, []);

  const handleSubmitComplaint = async () => {
    try {
      // Validate required fields
      if (!complaintForm.title || !complaintForm.location || !complaintForm.description || !complaintForm.coordinates || !complaintForm.image) {
        Alert.alert('Error', 'Please fill in all fields and select a location and image');
        return;
      }

      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      // Create form data for multipart/form-data request
      const formData = new FormData();
      formData.append('title', complaintForm.title);
      formData.append('description', complaintForm.description);
      formData.append('location', complaintForm.location);
      formData.append('latitude', complaintForm.coordinates.latitude.toString());
      formData.append('longitude', complaintForm.coordinates.longitude.toString());

      // Append image file
      const imageUri = complaintForm.image;
      const filename = imageUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : 'image';
      
      formData.append('image', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      // Make API call
      const response = await fetch(`${API_URL}/complaints/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      console.log('Complaint submission response:', await response.clone().text());

      if (!response.ok) {
        throw new Error('Failed to submit complaint');
      }

      const data = await response.json();
      if (data.success) {
        setComplaintForm({ title: '', location: '', description: '', coordinates: null, image: null });
        setShowForm(false);
        Alert.alert('Success', 'Complaint submitted successfully!');
        fetchComplaintStats();
      } else {
        throw new Error(data.error || 'Failed to submit complaint');
      }
    } catch (error) {
      console.error('Error submitting complaint:', error);
      Alert.alert('Error', 'Failed to submit complaint. Please try again.');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setComplaintForm(prev => ({ ...prev, image: result.assets[0].uri }));
    }
  };

  const handleMapLongPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    setComplaintForm(prev => ({
      ...prev,
      coordinates: coordinate,
      location: `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`
    }));
    Alert.alert('Location Selected', 'Location has been set for your complaint');
  };

  const fetchComplaintStats = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/complaints/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch complaint stats');
      }

      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        throw new Error(data.error || 'Failed to fetch complaint stats');
      }
    } catch (error) {
      console.error('Error fetching complaint stats:', error);
      // Optionally show an alert to the user
      // Alert.alert('Error', 'Failed to fetch complaint statistics');
    }
  };

  return (
    <View style={styles.complaintFormContainer}>
      <Text style={styles.sectionTitle}>Complaint Management</Text>
      
      <TouchableOpacity 
        style={styles.newComplaintButton}
        onPress={() => setShowForm(true)}
      >
        <Text style={styles.newComplaintButtonText}>New Complaint</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Complaint Title"
            value={complaintForm.title}
            onChangeText={(text) => setComplaintForm(prev => ({...prev, title: text}))}
          />

          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: 21.0499,  // Walwadi, Dhule coordinates (near Chavara School)
                longitude: 74.6514,
                latitudeDelta: 0.01, // Zoomed in view
                longitudeDelta: 0.01,
              }}
              onLongPress={handleMapLongPress}
            >
              {complaintForm.coordinates && (
                <Marker
                  coordinate={complaintForm.coordinates}
                  title="Complaint Location"
                  description="Long press anywhere to change location"
                />
              )}
            </MapView>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Location (Click on map to set)"
            value={complaintForm.location}
            editable={false}
          />

          <TouchableOpacity 
            style={styles.imageUploadButton} 
            onPress={pickImage}
          >
            <MaterialIcons name="add-photo-alternate" size={24} color="#666" />
            <Text style={styles.imageUploadText}>
              {complaintForm.image ? 'Change Image' : 'Add Image'}
            </Text>
          </TouchableOpacity>

          {complaintForm.image && (
            <Image
              source={{ uri: complaintForm.image }}
              style={styles.previewImage}
            />
          )}

          <TextInput
            style={styles.textArea}
            placeholder="Description"
            value={complaintForm.description}
            onChangeText={(text) => setComplaintForm(prev => ({...prev, description: text}))}
            multiline
            numberOfLines={4}
          />
          <View style={styles.formButtons}>
            <TouchableOpacity 
              style={[styles.formButton, styles.cancelButton]}
              onPress={() => setShowForm(false)}
            >
              <Text style={styles.formButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.formButton, styles.submitButton]}
              onPress={handleSubmitComplaint}
            >
              <Text style={styles.formButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.statsContainer}>
        <View style={styles.statsLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#00E396' }]} />
            <Text>Resolved: {stats.resolved}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF4560' }]} />
            <Text>Pending: {stats.pending}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

if (__DEV__ && Platform.OS === 'android') {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  // Suppress all NOBRIDGE and Response construction errors
  console.error = (...args) => {
    if (
      args[0]?.includes?.('Failed to construct \'Response\'') ||
      args[0]?.includes?.('NOBRIDGE') ||
      args[0]?.includes?.('status provided (0)') ||
      args[0]?.includes?.('outside the range')
    ) {
      return;
    }
    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    if (args[0]?.includes?.('NOBRIDGE')) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.log = (...args) => {
    if (args[0]?.includes?.('NOBRIDGE')) {
      return;
    }
    originalLog.apply(console, args);
  };
}

// Add handleDownloadReceipt function
const handleDownloadReceipt = async (transactionId: string) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const response = await fetch(`${API_URL}/payment/receipt/${transactionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Failed to download receipt');

    if (Platform.OS === 'web') {
      // Web platform handling
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${transactionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else {
      // Mobile platform handling
      const fileDir = FileSystem.documentDirectory + `receipt-${transactionId}.pdf`;
      const { uri } = await FileSystem.downloadAsync(
        `${API_URL}/payment/receipt/${transactionId}`,
        fileDir,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      // Open the PDF
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Open Receipt',
      });
    }
  } catch (error) {
    console.error('Error downloading receipt:', error);
    Alert.alert('Error', 'Failed to download receipt');
  }
};

export default function UserDashboard() {
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState('history');
  const [pendingTransaction, setPendingTransaction] = useState<PendingTransaction | undefined>();
  const [userData, setUserData] = useState<UserData | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const updateAllData = async () => {
      setRefreshing(true);
      try {
        await Promise.all([
          fetchUserData(),
          fetchTransactions()
        ]);
      } finally {
        setRefreshing(false);
      }
    };

    // Initial fetch
    updateAllData();

    // Set up polling every 10 seconds
    const pollInterval = setInterval(() => {
      updateAllData();
    }, 5000); // 10 seconds

    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    const timer = setInterval(() => {
      if (currentBannerIndex < banners.length - 1) {
        scrollViewRef.current?.scrollTo({
          x: (currentBannerIndex + 1) * Dimensions.get('window').width,
          animated: true
        });
        setCurrentBannerIndex(currentBannerIndex + 1);
      } else {
        scrollViewRef.current?.scrollTo({
          x: 0,
          animated: true
        });
        setCurrentBannerIndex(0);
      }
    }, 5000); // Changed from 3000 to 5000 (5 seconds)

    return () => clearInterval(timer);
  }, [currentBannerIndex]);

  const fetchUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const response = await fetchWithTimeout(
        `${API_URL}/user/me`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response?.ok) {
        const data = await response.json();
        if (data.success) {
          setUserData(data.user);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request timed out');
      } else {
        console.log('Error fetching user data:', error);
      }
    }
  };

  const fetchTransactions = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const response = await fetchWithTimeout(
        `${API_URL}/payment/transactions`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response?.ok) {
        const data = await response.json();
        if (data.success) {
          setTransactions(data.transactions);
          const pending = data.transactions.find((t: Transaction) => t.status === 'PENDING');
          if (pending) {
            setPendingTransaction(pending);
          } else {
            setPendingTransaction(undefined);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request timed out');
      } else {
        console.log('Error fetching transactions:', error);
      }
    }
  };

  const initiatePayment = async () => {
    try {
      setLoading(true);
      
      if (!pendingTransaction) {
        Alert.alert('Error', 'No pending payment found');
        return;
      }
      
      const requestData = {
        amount: pendingTransaction.amount,
        merchantUserId: userData?.uniqueId || "MUID123",
        mobileNumber: "9999999999",
        purpose: pendingTransaction.purpose || "Water Bill Payment"
      };
      
      const response = await fetchWithTimeout(
        `${API_URL}/payment/initiate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(requestData)
        },
        10000 // 10 second timeout for payment requests
      );

      if (!response?.ok) {
        throw new Error('Payment initiation failed');
      }

      const data = await response.json();
      if (data.success && data.data?.data?.instrumentResponse) {
        setPaymentUrl(data.data.data.instrumentResponse.redirectInfo.url);
      } else {
        throw new Error('Invalid payment response');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        Alert.alert('Error', 'Payment request timed out. Please try again.');
      } else {
        console.log('Payment error:', error);
        Alert.alert('Error', 'Failed to initiate payment. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNavigationStateChange = async (navState: any) => {
    console.log('Navigation state:', navState);
    
    const url = navState.url;
    
    // Handle successful payment redirect
    if (url.includes('webhook.site/redirect-url')) {
      try {
        // Find the current pending transaction
        const currentTransaction = transactions.find(t => t.status === 'PENDING');
        if (!currentTransaction) {
          setPaymentUrl(null);
          return;
        }
        
        // Check if transaction is already marked as success
        const isAlreadySuccess = transactions.some(t => 
          t.status === 'SUCCESS' && 
          t.amount === currentTransaction.amount &&
          t.purpose === currentTransaction.purpose
        );

        if (isAlreadySuccess) {
          setPaymentUrl(null);
          return;
        }

        // Get auth token
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication token not found');
        }

        // Update transaction status to SUCCESS with auth header
        const response = await fetch(`${API_URL}/payment/update-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: 'SUCCESS',
            transactionId: currentTransaction._id
          })
        });

        if (!response.ok) {
          throw new Error('Failed to update transaction status');
        }

        setPaymentUrl(null);
        setPendingTransaction(undefined);
        Alert.alert('Success', 'Payment successful!');
        await fetchTransactions();
      } catch (error) {
        console.error('Error updating transaction:', error);
        Alert.alert('Error', 'Failed to update payment status. Please contact support.');
      }
      return;
    }
    
    // Handle payment page navigation
    if (url.includes('mercury-uat.phonepe.com')) {
      // Only handle errors if the page is done loading
      if (!navState.loading && navState.title === '') {
        setPaymentUrl(null);
        Alert.alert('Error', 'Payment page failed to load. Please try again.');
        return;
      }
    }
    
    // Handle failure redirect
    if (url.includes('failure')) {
      setPaymentUrl(null);
      Alert.alert('Failed', 'Payment failed. Please try again.');
    }
  };

  if (paymentUrl) {
    return (
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri: paymentUrl }}
          onNavigationStateChange={handleNavigationStateChange}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.log('WebView error:', nativeEvent);
            // Only show error if not on redirect URL
            if (!nativeEvent.url?.includes('webhook.site')) {
              setPaymentUrl(null);
              Alert.alert('Error', 'Payment page failed to load. Please try again.');
            }
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.log('WebView HTTP error:', nativeEvent);
            // Only show error if not on redirect URL
            if (!nativeEvent.url?.includes('webhook.site')) {
              setPaymentUrl(null);
              Alert.alert('Error', 'Payment page failed to load. Please try again.');
            }
          }}
          renderLoading={() => (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text>Loading payment page...</Text>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Image 
        source={require('./bg1.jpg')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity>
              <MaterialIcons name="water-drop" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Jal Jeevan Mission</Text>
            <TouchableOpacity>
              <MaterialIcons name="notifications" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bannerSection}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            ref={scrollViewRef}
            onMomentumScrollEnd={(event) => {
              const slideSize = event.nativeEvent.layoutMeasurement.width;
              const index = event.nativeEvent.contentOffset.x / slideSize;
              setCurrentBannerIndex(Math.round(index));
            }}
          >
            {banners.map((banner) => (
              <Image
                key={banner.id}
                source={{ uri: banner.imageUrl }}
                style={styles.bannerImage}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
          <View style={styles.paginationDots}>
            {banners.map((banner, index) => (
              <View
                key={banner.id}
                style={[
                  styles.dot,
                  { backgroundColor: index === currentBannerIndex ? '#3b82f6' : '#ccc' }
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'transactions' && styles.activeTab]}
            onPress={() => setActiveTab('transactions')}
          >
            <FontAwesome5 name="history" size={20} color={activeTab === 'transactions' ? '#3b82f6' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'transactions' && styles.activeTabText]}>
              Transactions
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'pay' && styles.activeTab]}
            onPress={() => setActiveTab('pay')}
          >
            <MaterialIcons name="payment" size={20} color={activeTab === 'pay' ? '#3b82f6' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'pay' && styles.activeTabText]}>
              Pay
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tab, activeTab === 'complaint' && styles.activeTab]}
            onPress={() => setActiveTab('complaint')}
          >
            <Ionicons name="warning-outline" size={20} color={activeTab === 'complaint' ? '#3b82f6' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'complaint' && styles.activeTabText]}>
              Complaint
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mainContent}>
          {activeTab === 'transactions' ? (
            <View>
              {transactions
                .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
                .map((transaction) => (
                  <View key={transaction._id} style={styles.transactionCard}>
                    <View style={styles.transactionMain}>
                      <View>
                        <Text style={styles.transactionAmount}>₹{transaction.amount/100}</Text>
                        <Text style={styles.transactionPurpose}>{transaction.purpose}</Text>
                        <Text style={styles.transactionDate}>
                          Due: {new Date(transaction.dueDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </Text>
                        <Text style={[
                          styles.transactionStatus,
                          { color: transaction.status === 'SUCCESS' ? '#4CAF50' : '#F44336' }
                        ]}>
                          {transaction.status}
                        </Text>
                      </View>
                      <View style={styles.statusContainer}>
                        {transaction.status === 'SUCCESS' ? (
                          <MaterialIcons name="check-circle" size={32} color="#4CAF50" />
                        ) : (
                          <MaterialIcons name="error" size={32} color="#FFC107" />
                        )}
                      </View>
                    </View>
                    
                    {transaction.status === 'SUCCESS' && (
                      <TouchableOpacity 
                        style={styles.downloadButton}
                        onPress={() => handleDownloadReceipt(transaction._id)}
                      >
                        <MaterialIcons name="receipt" size={20} color="#fff" />
                        <Text style={styles.downloadButtonText}>Download Receipt</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
            </View>
          ) : activeTab === 'pay' ? (
            <PaymentSection 
              onPayment={initiatePayment} 
              pendingTransaction={pendingTransaction}
              refreshing={refreshing}
            />
          ) : (
            <ComplaintSection />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backgroundImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 1,
    zIndex: -1,
  },
  header: {
    backgroundColor: '#3b82f6',
    paddingTop: 40,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 4,
    margin: 16,
    borderRadius: 8,
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  activeTab: {
    backgroundColor: 'white',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    
  },
  activeTabText: {
    color: '#000',
    fontWeight: '500',
  },
  mainContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  imageUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  imageUploadText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoButtonText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#666',
  },
  complaintTextInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  paymentLabel: {
    fontSize: 16,
    color: '#666',
  },
  paymentAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  paymentDue: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  payButton: {
    backgroundColor: '#00bcd4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  transactionPurpose: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  transactionDate: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  transactionStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  noPaymentText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  paymentPurpose: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  profileId: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginTop: 8,
  },
  profileRole: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  complaintContainer: {
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  pieChartContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  totalComplaints: {
    position: 'absolute',
    top: '40%',
    fontSize: 24,
    fontWeight: 'bold',
  },
  complaintsLabel: {
    position: 'absolute',
    top: '50%',
    fontSize: 14,
    color: '#666',
  },
  statsLegend: {
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  complaintList: {
    marginTop: 16,
  },
  complaintCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  complaintImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  complaintDetails: {
    flex: 1,
  },
  complaintTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  complaintLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  complaintDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  escalateButton: {
    backgroundColor: '#FF4560',
    padding: 8,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  solveButton: {
    backgroundColor: '#00E396',
    padding: 8,
    borderRadius: 6,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 16,
  },
  bannerSection: {
    height: 200,  // You can adjust this height
    position: 'relative',
  },

  bannerImage: {
    width: Dimensions.get('window').width,
    height: '100%',
    resizeMode: 'contain',
  },

  paginationDots: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },

  // Consolidated Complaint Section Styles
  complaintFormContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  newComplaintButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  newComplaintButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  formContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  formButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#dc2626',
  },
  submitButton: {
    backgroundColor: '#059669',
  },
  formButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 16,
  },
  transactionMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 8,
  },
  statusContainer: {
    alignItems: 'center',
    marginRight: 0,
  },
  scrollViewContent: {
    flexGrow: 1,
    zIndex: 1,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  downloadButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
});

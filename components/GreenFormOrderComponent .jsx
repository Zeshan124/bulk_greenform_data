'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Spin, Image, Typography, Button, Input, message, Row, Col, Alert } from 'antd';
import axios from 'axios';

const { Title } = Typography;
const { TextArea } = Input;

const CNICImagesTable = () => {
  const [orderIds, setOrderIds] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const LOGIN_CREDENTIALS = {
    username: "arif",
    password: "qB(*&^%2aAi42907"
  };

  // Function to construct image URL with key parameter
  const getImageUrl = (path) => {
    if (!path) return null;
    
    // Remove 'public/' if it exists at the start
    const cleanPath = path.startsWith('public/') ? path.substring(7) : path;
    const baseUrl = `https://boms.qistbazaar.pk/${cleanPath}`;
    const key = 'A093m123a656n987N9874a09765i9875B9856a98675n98675a98675y98a65H87a27i';
    
    return `${baseUrl}?key=${key}`;
  };

  // Login function to get new token
  const login = async () => {
    setLoginLoading(true);
    try {
      const response = await axios.post('https://boms.qistbazaar.pk/api/user/login', LOGIN_CREDENTIALS);
      
      // Debug: Log the full response to understand the structure
      console.log('Login Response:', response.data);
      console.log('Response Status:', response.status);
      
      // Check different possible response structures
      if (response.data.success === true || response.data.status === 'success' || response.data.token) {
        // Try different possible token field names
        const newToken = response.data.token || response.data.accessToken || response.data.access_token || response.data.data?.token;
        
        if (!newToken) {
          console.error('No token found in response:', response.data);
          throw new Error('No token received from server');
        }
        
        setToken(newToken);
        
        // Set token expiry (10 hours from now)
        const expiryTime = new Date();
        expiryTime.setHours(expiryTime.getHours() + 10);
        setTokenExpiry(expiryTime);
        
        // Store in localStorage for persistence
        localStorage.setItem('apiToken', newToken);
        localStorage.setItem('tokenExpiry', expiryTime.toISOString());
        
        message.success('Login successful');
        return newToken;
      } else {
        // Log the response to understand why it's failing
        console.error('Login failed - Response data:', response.data);
        throw new Error(response.data.message || response.data.error || 'Login failed - unexpected response structure');
      }
    } catch (err) {
      console.error('Login error:', err);
      console.error('Error response:', err.response?.data);
      
      let errorMessage = 'Login failed';
      
      if (err.response?.data) {
        errorMessage = err.response.data.message || err.response.data.error || 'Login failed';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      message.error(`Login failed: ${errorMessage}`);
      setError(`Login failed: ${errorMessage}`);
      throw err;
    } finally {
      setLoginLoading(false);
    }
  };

  // Check if token is valid (not expired)
  const isTokenValid = useCallback(() => {
    if (!token || !tokenExpiry) return false;
    const now = new Date();
    const expiry = new Date(tokenExpiry);
    // Check if token expires in next 5 minutes (buffer time)
    return expiry.getTime() - now.getTime() > 5 * 60 * 1000;
  }, [token, tokenExpiry]);

  // Get valid token (login if needed)
  const getValidToken = async () => {
    if (isTokenValid()) {
      return token;
    }
    
    // Token is expired or doesn't exist, login again
    return await login();
  };

  // Load token from localStorage on component mount
  useEffect(() => {
    const savedToken = localStorage.getItem('apiToken');
    const savedExpiry = localStorage.getItem('tokenExpiry');
    
    if (savedToken && savedExpiry) {
      const expiryDate = new Date(savedExpiry);
      const now = new Date();
      
      // Check if saved token is still valid
      if (expiryDate.getTime() - now.getTime() > 5 * 60 * 1000) {
        setToken(savedToken);
        setTokenExpiry(expiryDate);
      } else {
        // Remove expired token
        localStorage.removeItem('apiToken');
        localStorage.removeItem('tokenExpiry');
      }
    }
  }, []);

  // Auto-login on component mount if no valid token
  useEffect(() => {
    if (!isTokenValid()) {
      login().catch(() => {
        // Error already handled in login function
      });
    }
  }, [isTokenValid]);

  const fetchSingleOrder = async (orderId, validToken) => {
    try {
      const apiConfig = {
        headers: {
          'x-access-token': validToken
        }
      };

      const response = await axios.get(
        `https://boms.qistbazaar.pk/api/order/greenform/get?orderID=${orderId}`,
        apiConfig
      );
      
      if (response.data.success) {
        return {
          orderId: orderId,
          success: true,
          data: response.data.data
        };
      } else {
        return {
          orderId: orderId,
          success: false,
          error: response.data.message || 'No data found'
        };
      }
    } catch (err) {
      // If unauthorized, might need to refresh token
      if (err.response?.status === 401) {
        return {
          orderId: orderId,
          success: false,
          error: 'Authentication failed - token may be expired'
        };
      }
      
      return {
        orderId: orderId,
        success: false,
        error: err.response?.data?.message || 'Failed to fetch data'
      };
    }
  };

  const fetchBulkData = async () => {
    if (!orderIds.trim()) {
      message.warning('Please enter at least one Order ID');
      return;
    }
    
    setLoading(true);
    setError(null);
    setData([]);
    
    try {
      // Get valid token before making API calls
      const validToken = await getValidToken();
      
      // Split order IDs by comma, newline, or space and filter empty values
      const orderIdList = orderIds
        .split(/[,\n\s]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0);
      
      if (orderIdList.length === 0) {
        message.warning('Please enter valid Order IDs');
        setLoading(false);
        return;
      }

      // Fetch all orders concurrently
      const promises = orderIdList.map(orderId => fetchSingleOrder(orderId, validToken));
      const results = await Promise.all(promises);
      
      // Check if any requests failed due to token issues
      const authFailures = results.filter(result => 
        !result.success && result.error.includes('Authentication failed')
      );
      
      if (authFailures.length > 0) {
        // Try to refresh token and retry
        message.warning('Token expired, refreshing and retrying...');
        const newToken = await login();
        const retryPromises = authFailures.map(failure => 
          fetchSingleOrder(failure.orderId, newToken)
        );
        const retryResults = await Promise.all(retryPromises);
        
        // Replace failed results with retry results
        retryResults.forEach((retryResult, index) => {
          const originalIndex = results.findIndex(r => r.orderId === authFailures[index].orderId);
          if (originalIndex !== -1) {
            results[originalIndex] = retryResult;
          }
        });
      }
      
      // Process results
      const successfulResults = results.filter(result => result.success);
      const failedResults = results.filter(result => !result.success);
      
      if (successfulResults.length > 0) {
        setData(successfulResults.map(result => result.data));
        message.success(`Successfully loaded ${successfulResults.length} orders`);
      }
      
      if (failedResults.length > 0) {
        const failedIds = failedResults.map(result => result.orderId).join(', ');
        message.warning(`Failed to load ${failedResults.length} orders: ${failedIds}`);
      }
      
      if (successfulResults.length === 0) {
        setError('No valid data found for any of the provided Order IDs');
      }
      
    } catch (err) {
      setError('An unexpected error occurred while fetching data');
      console.error('Bulk fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Order ID',
      dataIndex: 'orderID',
      key: 'orderID',
      width: 120,
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'CNIC',
      dataIndex: 'cnic',
      key: 'cnic',
      width: 150,
    },
    {
      title: 'Full Name',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 200,
    },
    {
      title: 'customerImage',
      dataIndex: 'customerImage',
      key: 'customerImage',
      width: 150,
      render: (value) => {
        return value ? (
          <Image
            width={120}
            height={80}
            src={getImageUrl(value)}
            placeholder={
              <div style={{ width: 120, height: 80, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Loading...
              </div>
            }
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          />
        ) : (
          <span style={{ color: '#999' }}>No Image</span>
        );
      },
    },
    
    {
      title: 'CNIC Front',
      dataIndex: 'cnicUrl',
      key: 'cnicUrl',
      width: 150,
      render: (value) => {
        return value ? (
          <Image
            width={120}
            height={80}
            src={getImageUrl(value)}
            placeholder={
              <div style={{ width: 120, height: 80, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Loading...
              </div>
            }
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          />
        ) : (
          <span style={{ color: '#999' }}>No Image</span>
        );
      },
    },
    {
      title: 'CNIC Back',
      dataIndex: 'cnicBackUrl',
      key: 'cnicBackUrl',
      width: 150,
      render: (value) => {
        return value ? (
          <Image
            width={120}
            height={80}
            src={getImageUrl(value)}
            placeholder={
              <div style={{ width: 120, height: 80, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Loading...
              </div>
            }
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          />
        ) : (
          <span style={{ color: '#999' }}>No Image</span>
        );
      },
    },
  ];

  const getTokenStatus = () => {
    if (!token) return { status: 'error', text: 'No token' };
    if (!isTokenValid()) return { status: 'warning', text: 'Token expired' };
    
    const now = new Date();
    const expiry = new Date(tokenExpiry);
    const hoursLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
    const minutesLeft = Math.floor(((expiry.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft < 1) {
      return { status: 'warning', text: `Token expires in ${minutesLeft} minutes` };
    }
    
    return { status: 'success', text: `Token valid for ${hoursLeft}h ${minutesLeft}m` };
  };

  const tokenStatus = getTokenStatus();

  return (
    <div style={{ padding: '20px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Title level={4} style={{ margin: 0 }}>Bulk CNIC Images Lookup</Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Alert
              message={tokenStatus.text}
              type={tokenStatus.status}
              showIcon
              size="small"
            />
            <Button 
              size="small" 
              onClick={login} 
              loading={loginLoading}
              disabled={loginLoading}
            >
              Refresh Token
            </Button>
          </div>
        </div>
        
        <Row gutter={16} style={{ marginBottom: '20px' }}>
          <Col span={18}>
            <TextArea
              placeholder="Enter Order IDs (separated by comma, space, or new line)&#10;Example: 12345, 12346, 12347"
              value={orderIds}
              onChange={(e) => setOrderIds(e.target.value)}
              rows={4}
            />
          </Col>
          <Col span={6}>
            <Button 
              type="primary" 
              onClick={fetchBulkData}
              disabled={!orderIds.trim() || loading || !token}
              style={{ width: '100%', height: '100%' }}
            >
              {loading ? (
                <>
                  <Spin size="small" /> Searching...
                </>
              ) : (
                'Search All'
              )}
            </Button>
          </Col>
        </Row>

        {error && (
          <div style={{ color: 'red', marginBottom: '20px', padding: '10px', background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        {data.length > 0 && (
          <>
            <Title level={5} style={{ marginTop: '20px' }}>
              CNIC Images ({data.length} orders found)
            </Title>
            <Table
              columns={columns}
              dataSource={data}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} orders`
              }}
              bordered
              size="small"
              loading={loading}
              rowKey="orderID"
              scroll={{ x: 800 }}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default CNICImagesTable;
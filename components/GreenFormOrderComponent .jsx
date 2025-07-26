"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Card,
  Spin,
  Image,
  Typography,
  Button,
  Input,
  message,
  Row,
  Col,
  Alert,
  Badge,
  Space,
  Divider,
  Tooltip,
  Empty,
  Progress,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text } = Typography;
const { TextArea } = Input;

const CNICImagesTable = () => {
  const [orderIds, setOrderIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);

  const LOGIN_CREDENTIALS = {
    username: "arif",
    password: "qB(*&^%2aAi42907",
  };

  // Function to construct image URL with key parameter
  const getImageUrl = (path) => {
    if (!path) return null;

    // Remove 'public/' if it exists at the start
    const cleanPath = path.startsWith("public/") ? path.substring(7) : path;
    const baseUrl = `https://boms.qistbazaar.pk/${cleanPath}`;
    const key =
      "A093m123a656n987N9874a09765i9875B9856a98675n98675a98675y98a65H87a27i";

    return `${baseUrl}?key=${key}`;
  };

  // Login function to get new token
  const login = async () => {
    setLoginLoading(true);
    try {
      const response = await axios.post(
        "https://boms.qistbazaar.pk/api/user/login",
        LOGIN_CREDENTIALS
      );

      // Debug: Log the full response to understand the structure
      console.log("Login Response:", response.data);
      console.log("Response Status:", response.status);

      // Check different possible response structures
      if (
        response.data.success === true ||
        response.data.status === "success" ||
        response.data.token
      ) {
        // Try different possible token field names
        const newToken =
          response.data.token ||
          response.data.accessToken ||
          response.data.access_token ||
          response.data.data?.token;

        if (!newToken) {
          console.error("No token found in response:", response.data);
          throw new Error("No token received from server");
        }

        setToken(newToken);

        // Set token expiry (10 hours from now)
        const expiryTime = new Date();
        expiryTime.setHours(expiryTime.getHours() + 10);
        setTokenExpiry(expiryTime);

        // Store in localStorage for persistence
        localStorage.setItem("apiToken", newToken);
        localStorage.setItem("tokenExpiry", expiryTime.toISOString());

        message.success("Authentication successful");
        return newToken;
      } else {
        // Log the response to understand why it's failing
        console.error("Login failed - Response data:", response.data);
        throw new Error(
          response.data.message ||
            response.data.error ||
            "Login failed - unexpected response structure"
        );
      }
    } catch (err) {
      console.error("Login error:", err);
      console.error("Error response:", err.response?.data);

      let errorMessage = "Authentication failed";

      if (err.response?.data) {
        errorMessage =
          err.response.data.message ||
          err.response.data.error ||
          "Authentication failed";
      } else if (err.message) {
        errorMessage = err.message;
      }

      message.error(`Authentication failed: ${errorMessage}`);
      setError(`Authentication failed: ${errorMessage}`);
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
    const savedToken = localStorage.getItem("apiToken");
    const savedExpiry = localStorage.getItem("tokenExpiry");

    if (savedToken && savedExpiry) {
      const expiryDate = new Date(savedExpiry);
      const now = new Date();

      // Check if saved token is still valid
      if (expiryDate.getTime() - now.getTime() > 5 * 60 * 1000) {
        setToken(savedToken);
        setTokenExpiry(expiryDate);
      } else {
        // Remove expired token
        localStorage.removeItem("apiToken");
        localStorage.removeItem("tokenExpiry");
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
          "x-access-token": validToken,
        },
      };

      const response = await axios.get(
        `https://boms.qistbazaar.pk/api/order/greenform/get?orderID=${orderId}`,
        apiConfig
      );

      if (response.data.success) {
        return {
          orderId: orderId,
          success: true,
          data: response.data.data,
        };
      } else {
        return {
          orderId: orderId,
          success: false,
          error: response.data.message || "No data found",
        };
      }
    } catch (err) {
      // If unauthorized, might need to refresh token
      if (err.response?.status === 401) {
        return {
          orderId: orderId,
          success: false,
          error: "Authentication failed - token may be expired",
        };
      }

      return {
        orderId: orderId,
        success: false,
        error: err.response?.data?.message || "Failed to fetch data",
      };
    }
  };

  const fetchBulkData = async () => {
    if (!orderIds.trim()) {
      message.warning("Please enter at least one Order ID");
      return;
    }

    setLoading(true);
    setError(null);
    setData([]);
    setSearchProgress(0);

    try {
      // Get valid token before making API calls
      const validToken = await getValidToken();

      // Split order IDs by comma, newline, or space and filter empty values
      const orderIdList = orderIds
        .split(/[,\n\s]+/)
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      if (orderIdList.length === 0) {
        message.warning("Please enter valid Order IDs");
        setLoading(false);
        return;
      }

      // Fetch all orders with progress tracking
      const promises = orderIdList.map(async (orderId, index) => {
        const result = await fetchSingleOrder(orderId, validToken);
        setSearchProgress(Math.round(((index + 1) / orderIdList.length) * 100));
        return result;
      });

      const results = await Promise.all(promises);

      // Check if any requests failed due to token issues
      const authFailures = results.filter(
        (result) =>
          !result.success && result.error.includes("Authentication failed")
      );

      if (authFailures.length > 0) {
        // Try to refresh token and retry
        message.warning("Token expired, refreshing and retrying...");
        const newToken = await login();
        const retryPromises = authFailures.map((failure) =>
          fetchSingleOrder(failure.orderId, newToken)
        );
        const retryResults = await Promise.all(retryPromises);

        // Replace failed results with retry results
        retryResults.forEach((retryResult, index) => {
          const originalIndex = results.findIndex(
            (r) => r.orderId === authFailures[index].orderId
          );
          if (originalIndex !== -1) {
            results[originalIndex] = retryResult;
          }
        });
      }

      // Process results
      const successfulResults = results.filter((result) => result.success);
      const failedResults = results.filter((result) => !result.success);

      if (successfulResults.length > 0) {
        setData(successfulResults.map((result) => result.data));
        message.success(
          `Successfully loaded ${successfulResults.length} of ${orderIdList.length} orders`
        );
      }

      if (failedResults.length > 0) {
        const failedIds = failedResults
          .map((result) => result.orderId)
          .join(", ");
        message.warning(
          `Failed to load ${failedResults.length} orders: ${failedIds}`
        );
      }

      if (successfulResults.length === 0) {
        setError("No valid data found for any of the provided Order IDs");
      }
    } catch (err) {
      setError("An unexpected error occurred while fetching data");
      console.error("Bulk fetch error:", err);
    } finally {
      setLoading(false);
      setSearchProgress(0);
    }
  };

  const columns = [
  {
      title: (
        <Space>
          <IdcardOutlined />
          <span>Order ID</span>
        </Space>
      ),
      dataIndex: 'orderID',
      key: 'orderID',
      width: 120,
      render: (text) => (
        <div style={{
          background: 'linear-gradient(135deg, #1890ff, #096dd9)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '6px',
          fontWeight: 'bold',
          textAlign: 'center',
          fontSize: '13px',
          boxShadow: '0 2px 4px rgba(24, 144, 255, 0.3)'
        }}>
          #{text}
        </div>
      ),
    },
    {
      title: (
        <Space>
          <SafetyCertificateOutlined />
          <span>CNIC Number</span>
        </Space>
      ),
      dataIndex: "cnic",
      key: "cnic",
      width: 150,
      render: (text) => (
        <Text code strong style={{ color: "#1890ff" }}>
          {text || "N/A"}
        </Text>
      ),
    },
    
    {
      title: (
        <Space>
          <UserOutlined />
          <span>Full Name</span>
        </Space>
      ),
      dataIndex: "fullName",
      key: "fullName",
      width: 200,
      render: (text) => (
        <Text strong style={{ color: "#2f54eb" }}>
          {text || "N/A"}
        </Text>
      ),
    },
        
    { 
      title: (
        <Space>
          <IdcardOutlined />
          <span>CNIC Front</span>
        </Space>
      ),
      dataIndex: "cnicUrl",
      key: "cnicUrl",
      width: 180,
      render: (value) => {
        return value ? (
          <div style={{ justifyContent: "start"  }}>
            <Image
              width={150}
              height={150}
              src={getImageUrl(value)}
              style={{
                borderRadius: "8px",
                border: "2px solid #f0f0f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
              placeholder={
                <div
                  style={{
                    width: 140,
                    height: 90,
                    background: "linear-gradient(45deg, #f0f0f0, #e8e8e8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "start",
                    borderRadius: "8px",
                  }}
                >
                  <Spin size="small" />
                </div>
              }
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            />
            <Text
              type="secondary"
              style={{ fontSize: "12px", display: "block", marginTop: "4px" }}
            >
              Front Side
            </Text>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <IdcardOutlined style={{ fontSize: "24px", color: "#d9d9d9" }} />
            <div style={{ color: "#999", fontSize: "12px" }}>No Image</div>
          </div>
        );
      },
    },
    
  
    {
      title: (
        <Space>
          <IdcardOutlined />
          <span>CNIC Back</span>
        </Space>
      ),
      dataIndex: "cnicBackUrl",
      key: "cnicBackUrl",
      width: 180,
      render: (value) => {
        return value ? (
          <div style={{ justifyContent: "start" }}>
            <Image
               width={150}
              height={150}
              src={getImageUrl(value)}
              style={{
                borderRadius: "8px",
                border: "2px solid #f0f0f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                
              }}
              placeholder={
                <div
                  style={{
                    width: 140,
                    height: 90,
                    background: "linear-gradient(45deg, #f0f0f0, #e8e8e8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "start",
                    borderRadius: "8px",
                  }}
                >
                  <Spin size="small" />
                </div>
              }
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            />
            <Text
              type="secondary"
              style={{ fontSize: "12px", display: "block", marginTop: "4px" }}
            >
              Back Side
            </Text>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <IdcardOutlined style={{ fontSize: "24px", color: "#d9d9d9" }} />
            <div style={{ color: "#999", fontSize: "12px" }}>No Image</div>
          </div>
        );
      },
    },
     {
      title: (
        <Space>
          <IdcardOutlined />
          <span>Customer Image</span>
        </Space>
      ),
      dataIndex: "customerImage",
      key: "customerImage",
      width: 180,
      render: (value) => {
        return value ? (
          <div style={{ justifyContent: "start" }}>
            <Image
              width={150}
              height={150}
              src={getImageUrl(value)}
              style={{
                borderRadius: "8px",
                border: "2px solid #f0f0f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
              placeholder={
                <div
                  style={{
                    width: 140,
                    height: 90,
                    background: "linear-gradient(45deg, #f0f0f0, #e8e8e8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "start",
                    borderRadius: "8px",
                  }}
                >
                  <Spin size="small" />
                </div>
              }
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            />
            <Text
              type="secondary"
              style={{ fontSize: "12px", display: "block", marginTop: "4px" }}
            >
              Customer
            </Text>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <IdcardOutlined style={{ fontSize: "24px", color: "#d9d9d9" }} />
            <div style={{ color: "#999", fontSize: "12px" }}>No Image</div>
          </div>
        );
      },
    }, 
       { 
      title: (
        <Space>
          <IdcardOutlined />
          <span>Signature</span>
        </Space>
      ),
      dataIndex: "signature",
      key: "signature",
      width: 180,
      render: (value) => {
        return value ? (
          <div style={{ justifyContent: "start"  }}>
            <Image
              width={150}
              height={150}
              src={getImageUrl(value)}
              style={{
                borderRadius: "8px",
                border: "2px solid #f0f0f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
              placeholder={
                <div
                  style={{
                    width: 140,
                    height: 90,
                    background: "linear-gradient(45deg, #f0f0f0, #e8e8e8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "start",
                    borderRadius: "8px",
                  }}
                >
                  <Spin size="small" />
                </div>
              }
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            />
            <Text
              type="secondary"
              style={{ fontSize: "12px", display: "block", marginTop: "4px" }}
            >
              Signature
            </Text>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <IdcardOutlined style={{ fontSize: "24px", color: "#d9d9d9" }} />
            <div style={{ color: "#999", fontSize: "12px" }}>No Image</div>
          </div>
        );
      },
    }, 
      { 
      title: (
        <Space>
          <IdcardOutlined />
          <span>Utility Bill</span>
        </Space>
      ),
      dataIndex: "utilityBill",
      key: "utilityBill",
      width: 180,
      render: (value) => {
        return value ? (
          <div style={{ justifyContent: "start"  }}>
            <Image
              width={150}
              height={150}
              src={getImageUrl(value)}
              style={{
                borderRadius: "8px",
                border: "2px solid #f0f0f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
              placeholder={
                <div
                  style={{
                    width: 140,
                    height: 90,
                    background: "linear-gradient(45deg, #f0f0f0, #e8e8e8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "start",
                    borderRadius: "8px",
                  }}
                >
                  <Spin size="small" />
                </div>
              }
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            />
            <Text
              type="secondary"
              style={{ fontSize: "12px", display: "block", marginTop: "4px" }}
            >
              Utility Bill
            </Text>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <IdcardOutlined style={{ fontSize: "24px", color: "#d9d9d9" }} />
            <div style={{ color: "#999", fontSize: "12px" }}>No Image</div>
          </div>
        );
      },
    },
  ];

  const getTokenStatus = () => {
    if (!token)
      return {
        status: "error",
        text: "No token",
        icon: <ExclamationCircleOutlined />,
      };
    if (!isTokenValid())
      return {
        status: "warning",
        text: "Token expired",
        icon: <ClockCircleOutlined />,
      };

    const now = new Date();
    const expiry = new Date(tokenExpiry);
    const hoursLeft = Math.floor(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60)
    );
    const minutesLeft = Math.floor(
      ((expiry.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60)
    );

    if (hoursLeft < 1) {
      return {
        status: "warning",
        text: `Expires in ${minutesLeft}m`,
        icon: <ClockCircleOutlined />,
      };
    }

    return {
      status: "success",
      text: `Valid for ${hoursLeft}h ${minutesLeft}m`,
      icon: <CheckCircleOutlined />,
    };
  };

  const tokenStatus = getTokenStatus();

  const getOrderIdCount = () => {
    if (!orderIds.trim()) return 0;
    return orderIds.split(/[,\n\s]+/).filter((id) => id.trim().length > 0)
      .length;
  };

  return (
    <div
      style={{
        padding: "24px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        minHeight: "100vh",
      }}
    >
      <Card
        style={{
          maxWidth: "100%",
          margin: "0 auto",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
          border: "none",
        }}
        bodyStyle={{ padding: "32px" }}
      >
        {/* Header Section */}
        <div style={{ marginBottom: "32px" }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space direction="vertical" size={0}>
                <Title
                  level={2}
                  style={{ margin: 0, color: "#1a1a1a", fontWeight: 600 }}
                >
                  <SafetyCertificateOutlined
                    style={{ marginRight: "12px", color: "#1890ff" }}
                  />
                  GreenForm Data Verification
                </Title>
                <Text type="secondary" style={{ fontSize: "16px" }}>
                  Bulk lookup and verification of Customer
                </Text>
              </Space>
            </Col>
            <Col>
              <Space size="middle">
                <Alert
                  message={tokenStatus.text}
                  type={tokenStatus.status}
                  icon={tokenStatus.icon}
                  showIcon
                  style={{
                    borderRadius: "8px",
                    border: "none",
                    fontWeight: 500,
                  }}
                />
                <Tooltip title="Refresh authentication token">
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={login}
                    loading={loginLoading}
                    disabled={loginLoading}
                    style={{
                      borderRadius: "8px",
                      height: "40px",
                      fontWeight: 500,
                    }}
                  >
                    Refresh Token
                  </Button>
                </Tooltip>
              </Space>
            </Col>
          </Row>
        </div>

        <Divider style={{ margin: "0 0 32px 0" }} />

        {/* Search Section */}
        <Card
          title={
            <Space>
              <SearchOutlined style={{ color: "#1890ff" }} />
              <span>Search Orders</span>
              {getOrderIdCount() > 0 && (
                <Badge
                  count={getOrderIdCount()}
                  style={{ backgroundColor: "#52c41a" }}
                />
              )}
            </Space>
          }
          style={{
            marginBottom: "24px",
            borderRadius: "12px",
            border: "1px solid #f0f0f0",
          }}
          headStyle={{
            borderBottom: "1px solid #f0f0f0",
            borderRadius: "12px 12px 0 0",
          }}
        >
          <Row gutter={[16, 16]}>
            <Col span={18}>
              <TextArea
                placeholder="📝 Enter Order IDs (separated by comma, space, or new line)&#10;&#10;Example:&#10;12345, 12346, 12347&#10;or&#10;12345&#10;12346&#10;12347"
                value={orderIds}
                onChange={(e) => setOrderIds(e.target.value)}
                rows={6}
                style={{
                  borderRadius: "8px",
                  fontSize: "14px",
                  lineHeight: "1.6",
                }}
              />
              {getOrderIdCount() > 0 && (
                <Text
                  type="secondary"
                  style={{
                    fontSize: "12px",
                    marginTop: "8px",
                    display: "block",
                  }}
                >
                  📊 {getOrderIdCount()} Order ID
                  {getOrderIdCount() > 1 ? "s" : ""} detected
                </Text>
              )}
            </Col>
            <Col span={6}>
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={fetchBulkData}
                  disabled={!orderIds.trim() || loading || !token}
                  size="large"
                  style={{
                    flex: 1,
                    borderRadius: "8px",
                    fontWeight: 600,
                    background: "linear-gradient(135deg, #1890ff, #096dd9)",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(24, 144, 255, 0.3)",
                  }}
                >
                  {loading ? "Searching..." : "Search All Orders"}
                </Button>

                {loading && (
                  <div style={{ textAlign: "center" }}>
                    <Progress
                      percent={searchProgress}
                      size="small"
                      status="active"
                      strokeColor={{
                        from: "#108ee9",
                        to: "#87d068",
                      }}
                    />
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      Processing...
                    </Text>
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert
            message="Search Error"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{
              marginBottom: "24px",
              borderRadius: "8px",
              border: "none",
            }}
          />
        )}

        {/* Results Section */}
        {data.length > 0 ? (
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
                <span>Search Results</span>
                <Badge
                  count={data.length}
                  style={{ backgroundColor: "#52c41a" }}
                />
              </Space>
            }
            style={{
              borderRadius: "12px",
              border: "1px solid #f0f0f0",
            }}
            headStyle={{
              borderBottom: "1px solid #f0f0f0",
              borderRadius: "12px 12px 0 0",
            }}
          >
            <Table
              columns={columns}
              dataSource={data}
              pagination={{
                pageSize: 8,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `Showing ${range[0]}-${range[1]} of ${total} orders`,
                style: { marginTop: "16px" },
              }}
              bordered={false}
              size="middle"
              loading={loading}
              rowKey="orderID"
              scroll={{ x: 900 }}
              style={{
                background: "#fafafa",
                borderRadius: "8px",
              }}
              rowClassName={(record, index) =>
                index % 2 === 0 ? "table-row-light" : "table-row-dark"
              }
            />
          </Card>
        ) : (
          !loading &&
          !error && (
            <Card style={{ textAlign: "center", borderRadius: "12px" }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Space direction="vertical">
                    <Text type="secondary" style={{ fontSize: "16px" }}>
                      No search results yet
                    </Text>
                    <Text type="secondary">
                      Enter Order IDs above and click "Search All Orders" to
                      begin
                    </Text>
                  </Space>
                }
              />
            </Card>
          )
        )}
      </Card>

      <style jsx>{`
        .table-row-light {
          background-color: #ffffff;
        }
        .table-row-dark {
          background-color: #fafafa;
        }
        .ant-table-thead > tr > th {
          background: linear-gradient(135deg, #f0f2f5, #e6f7ff);
          border-bottom: 2px solid #1890ff;
          font-weight: 600;
        }
        .ant-table-tbody > tr:hover > td {
          background-color: #e6f7ff !important;
        }
        .ant-image-img {
          transition: transform 0.3s ease;
        }
        .ant-image-img:hover {
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
};

export default CNICImagesTable;

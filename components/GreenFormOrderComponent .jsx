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
  Form,
} from "antd";
import {
  SearchOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  IdcardOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text } = Typography;
const { TextArea } = Input;

const CNICImagesTable = () => {
  const [orderIds, setOrderIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [token, setToken] = useState("");
  const [searchProgress, setSearchProgress] = useState(0);

  // Cookie utility functions with enhanced security
  const setCookie = (name, value, days = 7) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    
    // Enhanced cookie security settings
    const cookieString = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;secure;samesite=strict;httponly=false`;
    document.cookie = cookieString;
  };

  const getCookie = (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  };

  const deleteCookie = (name) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;secure;samesite=strict`;
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

  // Load token from cookie on component mount
  useEffect(() => {
    const savedToken = getCookie("apiToken");
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Save token to cookie whenever it changes
  useEffect(() => {
    if (token && token.trim()) {
      setCookie("apiToken", token, 7); // Store for 7 days
    } else if (!token || !token.trim()) {
      deleteCookie("apiToken");
    }
  }, [token]);

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
          error: "Authentication failed - invalid or expired token",
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

    if (!token.trim()) {
      message.warning("Please enter your authentication token");
      return;
    }

    setLoading(true);
    setError(null);
    setData([]);
    setSearchProgress(0);

    try {
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
        const result = await fetchSingleOrder(orderId, token);
        setSearchProgress(Math.round(((index + 1) / orderIdList.length) * 100));
        return result;
      });

      const results = await Promise.all(promises);

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

        // Check if any failures are due to authentication issues
        const authFailures = failedResults.filter((result) =>
          result.error.includes("Authentication failed")
        );

        if (authFailures.length > 0) {
          message.error(
            "Authentication failed. Please check your token and try again."
          );
        }
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

  const clearToken = () => {
    setToken("");
    deleteCookie("apiToken");
    message.info("Token cleared from cookies");
  };

  const columns = [
    {
      title: (
        <Space>
          <IdcardOutlined />
          <span>Order ID</span>
        </Space>
      ),
      dataIndex: "orderID",
      key: "orderID",
      width: 120,
      render: (text) => (
        <div
          style={{
            background: "linear-gradient(135deg, #1890ff, #096dd9)",
            color: "white",
            padding: "6px 12px",
            borderRadius: "6px",
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "13px",
            boxShadow: "0 2px 4px rgba(24, 144, 255, 0.3)",
          }}
        >
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
    if (!token.trim()) {
      return {
        status: "error",
        text: "No token provided",
        icon: <ExclamationCircleOutlined />,
      };
    }

    return {
      status: "success",
      text: "Token ready",
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
        styles={{
          body: {
            padding: "32px",
          },
        }}
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
                  Bulk lookup and verification of Customer Data
                </Text>
              </Space>
            </Col>
            <Col>
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
            </Col>
          </Row>
        </div>

        <Divider style={{ margin: "0 0 32px 0" }} />

        {/* Token Input Section */}
        <Card
          title={
            <Space>
              <KeyOutlined style={{ color: "#1890ff" }} />
              <span>Authentication Token</span>
              <Badge 
                count="Cookie Storage" 
                style={{ backgroundColor: "#52c41a", fontSize: "10px" }} 
              />
            </Space>
          }
          style={{
            marginBottom: "24px",
            borderRadius: "12px",
            border: "1px solid #f0f0f0",
          }}
          styles={{
            header: {
              borderBottom: "1px solid #f0f0f0",
              borderRadius: "12px 12px 0 0",
            },
          }}
        >
          <Row gutter={[16, 16]}>
            <Col span={20}>
              <Input.Password
                placeholder="Enter your authentication token from Postman..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                size="large"
                iconRender={(visible) =>
                  visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                }
                style={{
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
              <Text
                type="secondary"
                style={{
                  fontSize: "12px",
                  marginTop: "8px",
                  display: "block",
                }}
              >
                🔐 Token is securely stored in cookies (7 days expiry) | 🍪 No localStorage used
              </Text>
            </Col>
            <Col span={4}>
              <Button
                danger
                onClick={clearToken}
                disabled={!token.trim()}
                size="large"
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  fontWeight: 500,
                }}
              >
                Clear Token
              </Button>
            </Col>
          </Row>
        </Card>

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
                  disabled={!orderIds.trim() || loading || !token.trim()}
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
                      Enter your authentication token and Order IDs, then click
                      "Search All Orders" to begin
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
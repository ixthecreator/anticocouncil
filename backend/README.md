# 议事会议系统 (Assembly Meeting System) - Spring Boot Backend

本项目是“极简网格议事系统”的后端服务实现，使用 Spring Boot 框架、Spring Data JPA 以及 H2 嵌入式数据库（支持一键迁移至 PostgreSQL/MySQL）。

## 技术栈

- **Java 17+**
- **Spring Boot 3.2.5**
- **Spring Web** (提供高并发 RESTful API 端点)
- **Spring Data JPA** (支持对象关系映射与数据库流转)
- **H2 Database** (嵌入式/内存数据库，默认无需额外配置，开发体验极佳)
- **PostgreSQL** (已包含驱动依赖，可在 `application.properties` 中一键切换至生产数据库)

---

## 项目结构

```text
backend/
├── pom.xml                                   # Maven 依赖与构建配置
└── src/
    └── main/
        ├── java/
        │   └── com/
        │       └── assembly/
        │           └── meeting/
        │               ├── MeetingApplication.java      # Spring Boot 启动类
        │               ├── model/                      # 实体领域模型
        │               │   ├── Member.java             # 参会成员
        │               │   ├── Issue.java              # 子类会商议题
        │               │   └── Meeting.java            # 例会周期归档
        │               ├── repository/                 # 数据访问接口 (JPA Repositories)
        │               │   ├── MemberRepository.java
        │               │   ├── IssueRepository.java
        │               │   └── MeetingRepository.java
        │               └── controller/                 # REST 接口控制器 (Controllers)
        │                   ├── MemberController.java
        │                   ├── IssueController.java
        │                   └── MeetingController.java
        └── resources/
            └── application.properties                  # 端口、日志与数据源配置文件
```

---

## 本地启动指南

### 1. 克隆/导出代码并安装 Java 环境
确保本地计算机安装了 **Java Development Kit (JDK) 17** 或更高版本，并将 Maven 工具配置在环境变量中。

### 2. 编译并打包应用
在 `/backend` 目录下执行 Maven 编译命令：
```bash
mvn clean package
```

### 3. 运行应用
使用编译生成的 JAR 文件启动后端：
```bash
java -jar target/meeting-backend-1.0.0.jar
```
或者直接使用 Maven 插件就地启动：
```bash
mvn spring-boot:run
```

服务启动后，将绑定在本地的 **`8080`** 端口。所有 REST API 请求根路径为 `/api`。

---

## 核心 API 接口端点

所有端点均已配置了 `@CrossOrigin(origins = "*")` 跨域解析，保证与任何前端客户端的无缝流转。

### 1. 周期例会接口 (`/api/meetings`)
- `GET /api/meetings` - 获取全部周期例会（按创建时间正序排布）。
- `GET /api/meetings/{id}` - 根据 ID 获取单个周期例会。
- `POST /api/meetings` - 创建或更新一个周期例会（支持合并保存）。
- `PUT /api/meetings/{id}` - 更新具体周期的常规报告及属性。
- `DELETE /api/meetings/{id}` - 删除一个周期例会（内置级联机制，会自动解除旗下绑定的子类关联）。

### 2. 子类会商议题接口 (`/api/issues`)
- `GET /api/issues` - 获取全部议题列表。
- `GET /api/issues?meetingId={meetingId}` - 获取指定周期例会旗下绑定的全部子类议题。
- `GET /api/issues/{id}` - 获取特定子类的会商明细。
- `POST /api/issues` - 录入或覆盖保存一个子类议题。
- `PUT /api/issues/{id}` - 推进该子类的会商状态、结论、执行落款签字。
- `DELETE /api/issues/{id}` - 彻底删除特定子类。

### 3. 与会成员 roster 接口 (`/api/members`)
- `GET /api/members` - 获取全体已登记录入的委员会成员列表。
- `POST /api/members` - 新增或修改成员代表属性。
- `DELETE /api/members/{id}` - 注销/删除某一成员。

---

## 数据库调试后台 (H2 Console)

为了免去繁杂的数据库管理工具安装，本项目默认集成了浏览器端 H2 Console 控制台。

- **控制台地址:** `http://localhost:8080/api/h2-console`
- **JDBC URL:** `jdbc:h2:mem:meetingdb`
- **用户名:** `sa`
- **密码:** *(留空即可)*

您可以直接在控制台执行 `SELECT * FROM MEETINGS;` 等 SQL 语句来实时审查和调试数据持久化行为。

---

## 生产数据库切换 (以 PostgreSQL 为例)

若准备部署至云端/生产环境，仅需修改 `/backend/src/main/resources/application.properties` 文件：

```properties
# 替换 H2 驱动与 URL
spring.datasource.url=jdbc:postgresql://<your-db-host>:<port>/meeting_db
spring.datasource.username=<username>
spring.datasource.password=<password>
spring.datasource.driverClassName=org.postgresql.Driver

# 切换 Hibernate 方言
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
# 隐藏 H2 控制台
spring.h2.console.enabled=false
```

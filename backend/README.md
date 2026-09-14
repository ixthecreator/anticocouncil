# Spring Boot 旧后端示例

此目录是仓库保留的独立 Java 示例，**未接入当前安提柯议会网站**。正式前端使用 Firebase 或浏览器本地存储；根目录的 Bun/Vite 构建和 Vercel 部署不启动此服务。使用、开发或部署现有网站不需要 Java、Maven、H2 或 PostgreSQL，操作此示例也不会同步网站的业务数据。网站配置见[根 README](../README.md)。

示例仅包含会议、议题和成员三个实体及其 REST 控制器，没有当前网站的签到、成员审批、投票、文档导出等完整实现。`Member.role` 是普通业务字段，不是登录授权。

## 当前构建限制

[`pom.xml`](pom.xml) 的 `spring-boot-starter-web` 依赖缺少起始 `<dependency>` 标签，导致第 25 行出现不匹配的结束标签。当前文件无法通过 XML 解析，不能直接按下方命令构建；修复后还需验证 Maven 打包、Java 服务启动及接口行为。

POM 声明的技术版本为 Java 17、Spring Boot 3.2.5，依赖包括 Spring Web、Spring Data JPA、H2 和 PostgreSQL 驱动。仓库没有 Maven Wrapper；若要继续开发此示例，需自行准备 JDK 17 和 Maven，并先修复 POM。

## 修复 POM 后的启动参考

以下命令从仓库根目录开始执行；它们是与现有项目配置对应的参考，尚未通过运行验证。

```sh
cd backend
mvn clean package
java -jar target/meeting-backend-1.0.0.jar --server.address=127.0.0.1
```

也可在 `backend/` 目录使用 Maven 插件启动：

```sh
mvn spring-boot:run -Dspring-boot.run.arguments=--server.address=127.0.0.1
```

`application.properties` 指定端口 `8080`、上下文路径 `/api`，因此本地 API 根地址是 `http://localhost:8080/api`。上述参考命令将监听地址限定为本机；配置文件本身未限定监听地址。

控制器允许任意来源的 CORS 请求，未实现登录验证或访问权限检查。默认 H2 控制台开启且允许远程访问，数据库密码为空。这些是旧示例的现有设置，不能作为正式网站的后端部署配置。

## 源码中定义的 API

下表路径已包含 `/api`。响应与字段行为来自控制器源码，未作运行验收。

| 方法与路径 | 当前实现 |
| --- | --- |
| `GET /api/meetings` | 按 `createdAt` 升序查询全部会议 |
| `GET /api/meetings/{id}` | 查询单个会议，不存在返回 404 |
| `POST /api/meetings` | 按请求体的非空 `id` 保存会议 |
| `PUT /api/meetings/{id}` | 更新已有会议的 `title`、`week`、`date`、`summary`、`regularReport`、`issueIds`；不存在返回 404 |
| `DELETE /api/meetings/{id}` | 逐条将关联议题的 `meetingId` 设为空，再删除会议；不存在返回 404 |
| `GET /api/issues` | 查询全部议题，未指定排序 |
| `GET /api/issues?meetingId={id}` | 按非空 `meetingId` 查询议题，未指定排序 |
| `GET /api/issues/{id}` | 查询单个议题，不存在返回 404 |
| `POST /api/issues` | 按请求体的非空 `id` 保存议题 |
| `PUT /api/issues/{id}` | 更新已有议题的标题、分类、优先级、状态、描述、讨论、签名、更新时间、归档字段和 `meetingId`；不存在返回 404 |
| `DELETE /api/issues/{id}` | 删除议题，不存在返回 404 |
| `GET /api/members` | 查询全部成员，未指定排序 |
| `POST /api/members` | 按请求体的非空 `id` 保存成员 |
| `DELETE /api/members/{id}` | 删除成员，不存在返回 404 |

三个 POST 接口会拒绝缺失或空白的 `id`，成功返回 200。它们直接保存反序列化后的实体，不能当作仅修改已提供字段的 PATCH；PUT 也会写入源码列出的全部字段，遗漏字段可能清空旧值。服务没有自动生成编号或时间戳，也没有实现网站的状态转换和表决规则。

会议删除会保留议题本身，仅解除其 `meetingId` 关联。解绑与删除没有包在同一个控制器事务中，不保证整组操作的原子性。删除议题不会同步修订会议的 `issueIds`，删除成员也没有关联记录清理逻辑。

## 数据库配置

配置位于 `src/main/resources/application.properties`：

| 设置 | 当前值 |
| --- | --- |
| JDBC URL | `jdbc:h2:mem:meetingdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE` |
| 用户名 / 密码 | `sa` / 空 |
| Hibernate DDL | `update` |
| H2 控制台 | `http://localhost:8080/api/h2-console` |

H2 使用内存数据库；即使关闭最后一个连接后仍保留数据，Java 进程结束后数据也不会持久保存。控制台连接时使用上表的 JDBC URL 和账号。

POM 列出了 PostgreSQL 驱动。继续开发时可以调整数据源，例如：

```properties
spring.datasource.url=jdbc:postgresql://<host>:<port>/<database>
spring.datasource.username=<username>
spring.datasource.password=<password>
spring.datasource.driverClassName=org.postgresql.Driver
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.h2.console.enabled=false
```

这只是连接参数示例，未验证 PostgreSQL 运行兼容性，也不迁移任何数据。此示例没有数据库迁移脚本、从网站 Firebase 业务库导入数据的工具或 MySQL 驱动；切换数据库需要单独处理建库、表结构、已有数据和访问控制。默认的 `ddl-auto=update` 不能替代这些工作。

## 源码位置

| 路径 | 内容 |
| --- | --- |
| `pom.xml` | Maven 依赖与打包配置，存在上述 XML 错误 |
| `src/main/java/com/assembly/meeting/MeetingApplication.java` | Spring Boot 启动入口 |
| `src/main/java/com/assembly/meeting/model/` | 三个实体 |
| `src/main/java/com/assembly/meeting/repository/` | JPA 查询接口 |
| `src/main/java/com/assembly/meeting/controller/` | REST 控制器 |
| `src/main/resources/application.properties` | 端口、内存数据库和控制台配置 |
